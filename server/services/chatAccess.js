const ChatThread = require('../models/chatThreadModel');

async function assertThreadAccess(threadId, user) {
  const thread = await ChatThread.findById(threadId);
  if (!thread) return { error: { status: 404, message: 'Thread not found' } };
  const uid = String(user.id);
  const ok =
    (user.role === 'patient' && String(thread.patientId) === uid) ||
    (user.role === 'physiologist' && String(thread.physiologistId) === uid);
  if (!ok) return { error: { status: 403, message: 'Forbidden' } };
  return { thread };
}

module.exports = { assertThreadAccess };
