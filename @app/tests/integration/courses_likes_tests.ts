import { Pool, PoolClient } from 'pg'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

let pool: Pool
let client: PoolClient
const anonClient = createClient<Database>(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
  auth: {
    persistSession: false
  }
})
const serviceClient = createClient<Database>(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string,
  {
    auth: {
      persistSession: false
    }
  }
)

const TEST_EMAIL_DOMAIN = '@example.com'

const createTestUser = async (email: string): Promise<string> => {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true
  })

  if (error) throw error
  return data.user.id
}

const loginAsUser = async (email: string): Promise<SupabaseClient<Database>> => {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password: 'password123'
  })

  if (error) throw error

  return createClient<Database>(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`
      }
    }
  })
}

const createTestCourse = async (title: string = 'Test Course'): Promise<string> => {
  const { data, error } = await serviceClient.from('courses').insert({ title, active: true }).select('id').single()

  if (error) throw error
  return data.id
}

// Utility function to like a course using the service client (bypasses RLS)
const likeCourseWithServiceClient = async (userId: string, courseId: string) => {
  const { error } = await serviceClient.from('courses_likes').insert({
    user_id: userId,
    course_id: courseId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  if (error) throw error
}

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL })
  client = await pool.connect()
})

beforeEach(async () => {
  // Clear test data
  await client.query(
    `DELETE FROM public.courses_likes WHERE course_id IN (SELECT id FROM public.courses WHERE title = 'Test Course')`
  )
  await client.query(`DELETE FROM public.courses WHERE title = 'Test Course'`)
  const usersToDelete = await client.query(`SELECT id FROM auth.users WHERE email LIKE '%${TEST_EMAIL_DOMAIN}'`)
  const userIds = usersToDelete.rows.map((u) => u.id)
  if (userIds.length > 0) {
    await client.query(`DELETE FROM public.users WHERE auth_user_id = ANY($1)`, [userIds])
    await client.query(`DELETE FROM auth.users WHERE id = ANY($1)`, [userIds])
  }
})

describe('courses_likes RLS policies', () => {
  it('users can see their own liked courses', async () => {
    const userEmail = `user1${TEST_EMAIL_DOMAIN}`
    const userId = await createTestUser(userEmail)

    const courseId = await createTestCourse()

    // Like the course using service client (bypass RLS)
    await likeCourseWithServiceClient(userId, courseId)

    // Login as user
    const userClient = await loginAsUser(userEmail)

    const { data, error } = await userClient
      .from('courses_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0].user_id).toBe(userId)
    expect(data?.[0].course_id).toBe(courseId)
  })

  it('users cannot see other users liked courses', async () => {
    const user1Email = `user1${TEST_EMAIL_DOMAIN}`
    const user2Email = `user2${TEST_EMAIL_DOMAIN}`
    const user1Id = await createTestUser(user1Email)
    const user2Id = await createTestUser(user2Email)

    const courseId = await createTestCourse()

    // User1 likes the course (using service client to bypass RLS)
    await likeCourseWithServiceClient(user1Id, courseId)

    const user2Client = await loginAsUser(user2Email)

    const { data, error } = await user2Client
      .from('courses_likes')
      .select('*')
      .eq('user_id', user1Id)
      .eq('course_id', courseId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('users can insert their own likes', async () => {
    const userEmail = `user1${TEST_EMAIL_DOMAIN}`
    const userId = await createTestUser(userEmail)

    const courseId = await createTestCourse()

    const userClient = await loginAsUser(userEmail)

    const { error } = await userClient.from('courses_likes').insert({
      user_id: userId,
      course_id: courseId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('courses_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)

    expect(data).toHaveLength(1)
  })

  it('users cannot insert likes for other users', async () => {
    const user1Email = `user1${TEST_EMAIL_DOMAIN}`
    const user2Email = `user2${TEST_EMAIL_DOMAIN}`
    const user1Id = await createTestUser(user1Email)
    const user2Id = await createTestUser(user2Email)

    const courseId = await createTestCourse()

    const user1Client = await loginAsUser(user1Email)

    const { error } = await user1Client.from('courses_likes').insert({
      user_id: user2Id,
      course_id: courseId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    expect(error).not.toBeNull()

    const { data } = await serviceClient
      .from('courses_likes')
      .select('*')
      .eq('user_id', user2Id)
      .eq('course_id', courseId)

    expect(data).toHaveLength(0)
  })

  it('users can delete their own likes', async () => {
    const userEmail = `user1${TEST_EMAIL_DOMAIN}`
    const userId = await createTestUser(userEmail)

    const courseId = await createTestCourse()

    // Like the course using service client (bypass RLS)
    await likeCourseWithServiceClient(userId, courseId)

    const userClient = await loginAsUser(userEmail)

    const { error } = await userClient.from('courses_likes').delete().eq('user_id', userId).eq('course_id', courseId)

    expect(error).toBeNull()

    const { data } = await serviceClient
      .from('courses_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('course_id', courseId)

    expect(data).toHaveLength(0)
  })

  it('users cannot delete other users likes', async () => {
    const user1Email = `user1${TEST_EMAIL_DOMAIN}`
    const user2Email = `user2${TEST_EMAIL_DOMAIN}`
    const user1Id = await createTestUser(user1Email)
    const user2Id = await createTestUser(user2Email)

    const courseId = await createTestCourse()

    await likeCourseWithServiceClient(user1Id, courseId)

    const user2Client = await loginAsUser(user2Email)

    const { error } = await user2Client.from('courses_likes').delete().eq('user_id', user1Id).eq('course_id', courseId)

    const { data } = await serviceClient
      .from('courses_likes')
      .select('*')
      .eq('user_id', user1Id)
      .eq('course_id', courseId)

    expect(data).toHaveLength(1)
  })
})

afterAll(async () => {
  await client.release()
  await pool.end()
})
