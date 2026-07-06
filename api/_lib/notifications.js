const DEFAULT_PREFS = {
  messages: true,
  projects: true,
  billing: true,
  marketing: false,
}

export function mapNotificationToClient(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body ?? '',
    link: row.link ?? null,
    avatar: row.avatar ?? null,
    read: !!row.read,
    createdAt: row.created_at,
  }
}

export function prefAllowsEmail(prefs, category) {
  const merged = { ...DEFAULT_PREFS, ...(prefs || {}) }
  if (category === 'message') return merged.messages !== false
  if (category === 'booking' || category === 'contract') return merged.projects !== false
  if (category === 'payment') return merged.billing !== false
  if (category === 'marketing') return merged.marketing === true
  return true
}

export async function getNotificationPrefs(db, userId) {
  const { data } = await db
    .from('profiles')
    .select('notification_prefs')
    .eq('id', userId)
    .maybeSingle()
  return { ...DEFAULT_PREFS, ...(data?.notification_prefs || {}) }
}

export async function updateNotificationPrefs(db, userId, prefs) {
  const next = { ...DEFAULT_PREFS, ...prefs }
  const { data, error } = await db
    .from('profiles')
    .update({ notification_prefs: next, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('notification_prefs')
    .single()
  if (error) throw error
  return { ...DEFAULT_PREFS, ...(data?.notification_prefs || {}) }
}

export async function createNotification(db, {
  userId,
  type = 'system',
  title,
  body = null,
  link = null,
  avatar = null,
  metadata = {},
}) {
  if (!db || !userId || !title) return null

  const { data, error } = await db
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      body,
      link,
      avatar,
      metadata,
    })
    .select()
    .single()

  if (error) {
    console.error('[notifications] insert failed:', error.message)
    return null
  }
  return mapNotificationToClient(data)
}

export async function listNotificationsForUser(db, userId, { limit = 50 } = {}) {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).map(mapNotificationToClient)
}

export async function markNotificationRead(db, userId, notificationId) {
  const { data, error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select()
    .maybeSingle()

  if (error) throw error
  return data ? mapNotificationToClient(data) : null
}

export async function markAllNotificationsRead(db, userId) {
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) throw error
  return { ok: true }
}

export async function notifyUser(db, userId, payload, { email = null } = {}) {
  const notification = await createNotification(db, { userId, ...payload })
  if (email && notification) {
    const { sendTransactionalEmail } = await import('./email.js')
    await sendTransactionalEmail({
      to: email.to,
      subject: email.subject || payload.title,
      html: email.html,
      category: email.category || payload.type,
      prefs: email.prefs,
    })
  }
  return notification
}
