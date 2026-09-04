import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbStore } from './server/dbStore.js';
import {
  authenticateToken,
  handleForgotPassword,
  handleResetPassword,
  handleGetCurrentUser,
  handleLogin,
  handleRegister,
  handleLogout,
  handleUpdateProfile,
  sanitizeUser,
} from './server/auth.js';
import {
  processAIQuery,
  generateDatabaseWithAI,
  generateDatabaseInsights,
  generateDataCleaningAnalysis,
  generateExecutiveAIReport,
} from './server/gemini.js';
import { DatabaseSchema, RecordItem } from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'NexusDB AI', timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.post('/api/auth/login', handleLogin);
  app.post('/api/auth/logout', authenticateToken, handleLogout);
  app.post('/api/auth/register', handleRegister);
  app.post('/api/auth/forgot-password', handleForgotPassword);
  app.post('/api/auth/reset-password', handleResetPassword);
  app.get('/api/auth/me', authenticateToken, handleGetCurrentUser);
  app.put('/api/auth/profile', authenticateToken, handleUpdateProfile);

  // Activity Timeline Endpoints
  app.get('/api/activity', authenticateToken, (req, res) => {
    const userLogs = dbStore.getLogsForUser(req.user!.id);
    res.json({ activities: userLogs });
  });

  app.post('/api/activity/log', authenticateToken, (req, res) => {
    const { action, details, category, type } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required' });
    const log = dbStore.addLog(
      action,
      req.user!.email,
      type || 'info',
      details || '',
      req.user!.id,
      category || 'General'
    );
    res.json({ activity: log });
  });

  app.delete('/api/activity/clear', authenticateToken, (req, res) => {
    dbStore.clearLogsForUser(req.user!.id);
    res.json({ message: 'Activity history cleared' });
  });

  // Notifications Routes
  app.get('/api/notifications', authenticateToken, (req, res) => {
    const notifications = dbStore.getNotificationsForUser(req.user!.id);
    res.json({ notifications });
  });

  app.post('/api/notifications', authenticateToken, async (req, res) => {
    const { title, message, type, link, databaseId, targetUserId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    const notif = await dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: targetUserId || req.user!.id,
      title,
      message,
      type: type || 'system',
      isRead: false,
      createdAt: new Date().toISOString(),
      link,
      databaseId,
    });
    res.status(201).json({ notification: notif });
  });

  app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    const success = await dbStore.markNotificationAsRead(req.params.id, req.user!.id);
    res.json({ success });
  });

  app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    const success = await dbStore.markAllNotificationsAsRead(req.user!.id);
    res.json({ success });
  });

  app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    const success = await dbStore.deleteNotification(req.params.id, req.user!.id);
    res.json({ success });
  });

  app.delete('/api/notifications', authenticateToken, async (req, res) => {
    const count = await dbStore.clearNotificationsForUser(req.user!.id);
    res.json({ cleared: count });
  });

  // Global Realtime Search Route
  app.get('/api/search', authenticateToken, (req, res) => {
    const query = (req.query.q as string) || '';
    const userId = req.user!.id;
    const results = dbStore.searchAll(query, userId);
    res.json(results);
  });

  // Public Share Link Route
  app.get('/api/share/:token', (req, res) => {
    const { token } = req.params;
    const result = dbStore.getDatabaseByShareToken(token);
    if (!result) {
      return res.status(404).json({ error: 'Share link expired, invalid, or max usage reached.' });
    }

    const { db, shareLink } = result;
    // Increment link usage
    shareLink.currentUses += 1;

    // Get records for shared db
    const records = dbStore.records.filter((r) => r.databaseId === db.id && !r.isArchived);

    res.json({
      database: {
        ...db,
        myRole: shareLink.role,
        isSharedWithMe: true,
      },
      records,
      shareLinkRole: shareLink.role,
      canEdit: shareLink.role !== 'Viewer',
    });
  });

  // Database Collaboration & Sharing Endpoints
  app.post('/api/databases/:id/collaborators', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { email, role, name } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    const targetUser = dbStore.getUserByEmail(email);
    const collaborator = {
      id: 'collab-' + Date.now(),
      email: email.trim().toLowerCase(),
      name: name || (targetUser ? targetUser.name : email.split('@')[0]),
      role,
      addedAt: new Date().toISOString(),
      status: 'accepted' as const,
      userId: targetUser ? targetUser.id : undefined,
    };

    const updatedDb = await dbStore.addCollaborator(id, collaborator, req.user!.id);
    if (!updatedDb) {
      return res.status(404).json({ error: 'Database not found or only the owner can manage collaborators.' });
    }

    // Send notification to target user if registered (Share invitation received)
    if (targetUser) {
      dbStore.addNotification({
        id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: targetUser.id,
        title: 'Share Invitation Received',
        message: `${req.user!.name || req.user!.email} invited you to collaborate on database "${updatedDb.name}" as ${role}.`,
        type: 'invite',
        isRead: false,
        createdAt: new Date().toISOString(),
        databaseId: updatedDb.id,
        link: `/database/${updatedDb.id}`,
      });
    }

    // Send notification to the user who shared the database (Database shared)
    dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: req.user!.id,
      title: 'Database Shared',
      message: `You shared "${updatedDb.name}" with ${email} as ${role}.`,
      type: 'share',
      isRead: false,
      createdAt: new Date().toISOString(),
      databaseId: updatedDb.id,
      link: `/database/${updatedDb.id}`,
    });

    dbStore.addLog('Database Sharing (Collaborator Added)', req.user!.email, 'info', `Added ${email} as ${role} to "${updatedDb.name}"`, req.user!.id, 'Sharing');
    res.json({ database: updatedDb, message: `Collaborator ${email} added successfully.` });
  });

  // Accept Share Invitation endpoint
  app.post('/api/databases/:id/accept-invite', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const targetDb = dbStore.getDatabaseById(id, req.user!.id);
    if (!targetDb) {
      return res.status(404).json({ error: 'Database not found' });
    }

    // Notify Database Owner if different
    if (targetDb.userId && targetDb.userId !== req.user!.id) {
      dbStore.addNotification({
        id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: targetDb.userId,
        title: 'Invitation Accepted',
        message: `${req.user!.name || req.user!.email} accepted the invitation to collaborate on "${targetDb.name}".`,
        type: 'invite',
        isRead: false,
        createdAt: new Date().toISOString(),
        databaseId: targetDb.id,
        link: `/database/${targetDb.id}`,
      });
    }

    // Notify Collaborator
    dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: req.user!.id,
      title: 'Invitation Accepted',
      message: `You accepted collaboration access to "${targetDb.name}".`,
      type: 'invite',
      isRead: false,
      createdAt: new Date().toISOString(),
      databaseId: targetDb.id,
      link: `/database/${targetDb.id}`,
    });

    dbStore.addLog('Database Sharing (Invite Accepted)', req.user!.email, 'success', `Accepted invitation for "${targetDb.name}"`, req.user!.id, 'Sharing');
    res.json({ success: true, message: 'Invitation accepted', database: targetDb });
  });

  app.delete('/api/databases/:id/collaborators/:email', authenticateToken, async (req, res) => {
    const { id, email } = req.params;
    const updatedDb = await dbStore.removeCollaborator(id, email, req.user!.id);
    if (!updatedDb) {
      return res.status(404).json({ error: 'Database not found or unauthorized' });
    }

    dbStore.addLog('Database Sharing (Collaborator Removed)', req.user!.email, 'warning', `Removed ${email} from "${updatedDb.name}"`, req.user!.id, 'Sharing');
    res.json({ database: updatedDb, message: `Removed ${email} from workspace.` });
  });

  app.patch('/api/databases/:id/collaborators/:email', authenticateToken, async (req, res) => {
    const { id, email } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required' });

    const updatedDb = await dbStore.updateCollaboratorRole(id, email, role, req.user!.id);
    if (!updatedDb) {
      return res.status(404).json({ error: 'Database not found or unauthorized' });
    }

    dbStore.addLog('Database Sharing (Role Updated)', req.user!.email, 'info', `Updated ${email} role to ${role} in "${updatedDb.name}"`, req.user!.id, 'Sharing');
    res.json({ database: updatedDb, message: `Updated ${email} role to ${role}.` });
  });

  app.post('/api/databases/:id/share-links', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { role, allowPublicEdit, maxUses, expiresAt } = req.body;

    const token = 'sh-' + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    const shareLink = {
      id: 'link-' + Date.now(),
      token,
      role: role || 'Viewer',
      allowPublicEdit: !!allowPublicEdit,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || undefined,
      maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      currentUses: 0,
      active: true,
    };

    const updatedDb = await dbStore.addShareLink(id, shareLink, req.user!.id);
    if (!updatedDb) {
      return res.status(404).json({ error: 'Database not found or unauthorized' });
    }

    dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: req.user!.id,
      title: 'Database Shared',
      message: `Created a public share link (${role || 'Viewer'}) for "${updatedDb.name}".`,
      type: 'share',
      isRead: false,
      createdAt: new Date().toISOString(),
      databaseId: updatedDb.id,
      link: `/database/${updatedDb.id}`,
    });

    dbStore.addLog('Database Sharing (Link Created)', req.user!.email, 'info', `Created public share link (${role || 'Viewer'}) for "${updatedDb.name}"`, req.user!.id, 'Sharing');
    res.json({ shareLink, database: updatedDb, message: 'Share link generated successfully.' });
  });

  app.delete('/api/databases/:id/share-links/:linkId', authenticateToken, async (req, res) => {
    const { id, linkId } = req.params;
    const updatedDb = await dbStore.deleteShareLink(id, linkId, req.user!.id);
    if (!updatedDb) {
      return res.status(404).json({ error: 'Database not found or unauthorized' });
    }

    dbStore.addLog('Database Sharing (Link Revoked)', req.user!.email, 'warning', `Revoked public share link for "${updatedDb.name}"`, req.user!.id, 'Sharing');
    res.json({ database: updatedDb, message: 'Share link revoked.' });
  });


  // Global Realtime Search Route
  app.get('/api/search', authenticateToken, (req, res) => {
    const query = (req.query.q as string) || '';
    const userId = req.user!.id;
    const results = dbStore.searchAll(query, userId);
    res.json(results);
  });

  // Database Schema Endpoints
  app.get('/api/databases', authenticateToken, (req, res) => {
    const userDbs = dbStore.getDatabasesForUser(req.user!.id);
    res.json({ databases: userDbs });
  });

  app.post('/api/databases', authenticateToken, async (req, res) => {
    const { name, description, category, icon, color, fields } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Database name and category are required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newDb: DatabaseSchema = {
      id: 'db-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: req.user!.id,
      name: name.trim(),
      slug,
      description: description || '',
      category: category || 'Custom',
      icon: icon || 'Database',
      color: color || 'blue',
      fields: fields || [
        { id: 'f_id', name: 'title', label: 'Item Title', type: 'Text', required: true, isPrimary: true },
        { id: 'f_desc', name: 'description', label: 'Description', type: 'Long Text' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbStore.addDatabase(newDb);
    dbStore.addLog(
      'Database Created',
      req.user!.email,
      'success',
      `Created database "${name}" with ${newDb.fields.length} fields.`,
      req.user!.id
    );

    res.status(201).json({ database: newDb, message: 'Database created successfully' });
  });

  app.put('/api/databases/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const updated = await dbStore.updateDatabase(id, req.body, req.user!.id);
    if (!updated) {
      return res.status(404).json({ error: 'Database not found or unauthorized' });
    }

    dbStore.addLog('Database Updated', req.user!.email, 'info', `Updated schema for "${updated.name}"`, req.user!.id);
    res.json({ database: updated, message: 'Database updated' });
  });

  app.delete('/api/databases/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const success = await dbStore.deleteDatabase(id, req.user!.id);
    if (!success) {
      return res.status(404).json({ error: 'Database not found or unauthorized' });
    }

    dbStore.addLog('Database Deleted', req.user!.email, 'warning', `Deleted database [${id}] and associated records.`, req.user!.id);
    res.json({ message: 'Database deleted successfully' });
  });

  app.post('/api/databases/:id/favorite', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const result = await dbStore.toggleFavorite(id, req.user!.id);
    if (!result) {
      return res.status(404).json({ error: 'Database not found' });
    }

    const userDbs = dbStore.getDatabasesForUser(req.user!.id);
    const updatedDb = userDbs.find((d) => d.id === id);

    dbStore.addLog(
      result.isFavorite ? 'Database Favorited' : 'Database Unfavorited',
      req.user!.email,
      'info',
      `${result.isFavorite ? 'Starred' : 'Unstarred'} database "${updatedDb?.name || id}"`,
      req.user!.id
    );

    res.json({
      isFavorite: result.isFavorite,
      database: updatedDb,
      message: result.isFavorite ? 'Database added to favorites' : 'Database removed from favorites',
    });
  });

  // Record Endpoints
  app.get('/api/records', authenticateToken, (req, res) => {
    const { databaseId, includeArchived } = req.query;
    const records = dbStore.getRecordsForUser(
      req.user!.id,
      databaseId as string | undefined,
      includeArchived === 'true'
    );

    res.json({ records });
  });

  app.post('/api/records', authenticateToken, async (req, res) => {
    const { databaseId, data } = req.body;
    if (!databaseId || !data) {
      return res.status(400).json({ error: 'databaseId and data are required' });
    }

    const newRec: RecordItem = {
      id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: req.user!.id,
      databaseId,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
    };

    await dbStore.addRecord(newRec);
    const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
    dbStore.addLog(
      'Record Creation',
      req.user!.email,
      'success',
      `Created new record in "${targetDb?.name || databaseId}"`,
      req.user!.id,
      'Record'
    );

    res.status(201).json({ record: newRec, message: 'Record created' });
  });

  app.put('/api/records/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { data, isArchived } = req.body;

    const updated = await dbStore.updateRecord(id, { data, isArchived }, req.user!.id);
    if (!updated) {
      return res.status(404).json({ error: 'Record not found or unauthorized' });
    }

    const targetDb = dbStore.getDatabaseById(updated.databaseId, req.user!.id);
    dbStore.addLog(
      'Record Editing',
      req.user!.email,
      'info',
      `Updated record in "${targetDb?.name || updated.databaseId}"`,
      req.user!.id,
      'Record'
    );

    res.json({ record: updated, message: 'Record updated' });
  });

  app.delete('/api/records/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const existing = dbStore.getRecordById(id, req.user!.id);
    const targetDb = existing ? dbStore.getDatabaseById(existing.databaseId, req.user!.id) : null;
    const success = await dbStore.deleteRecord(id, req.user!.id);
    if (!success) {
      return res.status(404).json({ error: 'Record not found or unauthorized' });
    }

    dbStore.addLog(
      'Record Deletion',
      req.user!.email,
      'warning',
      `Deleted record from "${targetDb?.name || 'database'}"`,
      req.user!.id,
      'Record'
    );
    res.json({ message: 'Record deleted' });
  });

  // Duplicate Record
  app.post('/api/records/:id/duplicate', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const original = dbStore.getRecordById(id, req.user!.id);
    if (!original) {
      return res.status(404).json({ error: 'Record not found or unauthorized' });
    }

    const dupData = { ...original.data };
    const firstKey = Object.keys(dupData)[0];
    if (firstKey && typeof dupData[firstKey] === 'string') {
      dupData[firstKey] += ' (Copy)';
    }

    const duplicated: RecordItem = {
      id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: req.user!.id,
      databaseId: original.databaseId,
      data: dupData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
    };

    await dbStore.addRecord(duplicated);
    const targetDb = dbStore.getDatabaseById(original.databaseId, req.user!.id);
    dbStore.addLog(
      'Record Creation (Duplicate)',
      req.user!.email,
      'info',
      `Duplicated record in "${targetDb?.name || original.databaseId}"`,
      req.user!.id,
      'Record'
    );

    res.json({ record: duplicated, message: 'Record duplicated successfully' });
  });

  // Bulk Operations
  app.post('/api/records/bulk-delete', authenticateToken, async (req, res) => {
    const { recordIds } = req.body;
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: 'recordIds array is required' });
    }

    const count = await dbStore.bulkDeleteRecords(recordIds, req.user!.id);
    dbStore.addLog(
      'Record Deletion (Bulk)',
      req.user!.email,
      'warning',
      `Bulk deleted ${count} records from database.`,
      req.user!.id,
      'Record'
    );

    res.json({ message: `Successfully deleted ${count} records` });
  });

  app.post('/api/records/bulk-archive', authenticateToken, async (req, res) => {
    const { recordIds, archive } = req.body;
    if (!Array.isArray(recordIds)) {
      return res.status(400).json({ error: 'recordIds array is required' });
    }

    const count = await dbStore.bulkArchiveRecords(recordIds, archive !== false, req.user!.id);
    dbStore.addLog(
      'Record Editing (Archive)',
      req.user!.email,
      'info',
      `${archive !== false ? 'Archived' : 'Restored'} ${count} record(s).`,
      req.user!.id,
      'Record'
    );

    res.json({ message: `Updated archive state for ${count} records` });
  });

  app.post('/api/records/bulk-update', authenticateToken, async (req, res) => {
    const { recordIds, fieldName, fieldValue } = req.body;
    if (!Array.isArray(recordIds) || !fieldName) {
      return res.status(400).json({ error: 'recordIds and fieldName required' });
    }

    const count = await dbStore.bulkUpdateRecords(recordIds, fieldName, fieldValue, req.user!.id);
    dbStore.addLog(
      'Record Editing (Bulk)',
      req.user!.email,
      'info',
      `Bulk updated field "${fieldName}" across ${count} records.`,
      req.user!.id,
      'Record'
    );

    res.json({ message: `Successfully updated ${count} records` });
  });

  // Bulk CSV Import
  app.post('/api/records/import-csv', authenticateToken, async (req, res) => {
    const { databaseId, rows } = req.body;
    if (!databaseId || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'databaseId and rows array required' });
    }

    const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
    if (!targetDb) {
      return res.status(404).json({ error: 'Database not found or unauthorized' });
    }

    const newRecords: RecordItem[] = [];
    for (const row of rows) {
      const rec: RecordItem = {
        id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
        userId: req.user!.id,
        databaseId,
        data: row,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
      };
      await dbStore.addRecord(rec);
      newRecords.push(rec);
    }

    dbStore.addLog(
      'Data Import (CSV / Dataset)',
      req.user!.email,
      'success',
      `Imported ${newRecords.length} records into database "${targetDb.name}"`,
      req.user!.id,
      'Import'
    );

    // Send notification (Import completed)
    dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId: req.user!.id,
      title: 'Import Completed',
      message: `Successfully imported ${newRecords.length} records into database "${targetDb.name}".`,
      type: 'import',
      isRead: false,
      createdAt: new Date().toISOString(),
      databaseId: targetDb.id,
      link: `/database/${targetDb.id}`,
    });

    res.json({ importedCount: newRecords.length, message: `Successfully imported ${newRecords.length} records` });
  });

  // Workspace Backup & Export/Import/Clear
  app.get('/api/workspace/export', authenticateToken, (req, res) => {
    const userId = req.user!.id;
    const userDbs = dbStore.getDatabasesForUser(userId);
    const userRecs = dbStore.getRecordsForUser(userId, undefined, true);

    const backup = {
      exportDate: new Date().toISOString(),
      user: req.user,
      databases: userDbs,
      records: userRecs,
    };

    dbStore.addLog(
      'Data Export (Workspace Backup)',
      req.user!.email,
      'info',
      `Exported full workspace backup containing ${userDbs.length} databases and ${userRecs.length} records.`,
      userId,
      'Export'
    );

    // Send notification (Export completed)
    dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId,
      title: 'Export Completed',
      message: `Full workspace backup exported with ${userDbs.length} database(s) and ${userRecs.length} record(s).`,
      type: 'export',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=nexusdb_export_${userId}.json`);
    res.send(JSON.stringify(backup, null, 2));
  });

  app.post('/api/workspace/import', authenticateToken, async (req, res) => {
    const { databases, records } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(databases) || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }

    for (const db of databases) {
      const dbCopy = { ...db, userId, id: db.id || 'db-' + Date.now() };
      await dbStore.addDatabase(dbCopy);
    }

    for (const rec of records) {
      const recCopy = { ...rec, userId, id: rec.id || 'rec-' + Date.now() };
      await dbStore.addRecord(recCopy);
    }

    dbStore.addLog(
      'Data Import (Workspace Restored)',
      req.user!.email,
      'success',
      `Restored ${databases.length} databases and ${records.length} records from backup.`,
      userId,
      'Import'
    );

    // Send notification (Import completed)
    dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId,
      title: 'Import Completed',
      message: `Workspace backup imported successfully: ${databases.length} database(s) and ${records.length} record(s) restored.`,
      type: 'import',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    res.json({ message: 'Workspace successfully restored from backup' });
  });

  app.delete('/api/workspace/clear', authenticateToken, async (req, res) => {
    const userId = req.user!.id;
    await dbStore.clearUserWorkspace(userId);
    dbStore.addLog('Workspace Cleared', req.user!.email, 'warning', 'All user databases and records deleted.', userId);
    res.json({ message: 'Workspace cleared successfully' });
  });

  // AI Endpoints
  app.post('/api/ai/insights', authenticateToken, async (req, res) => {
    const { databaseId } = req.body;
    if (!databaseId) {
      return res.status(400).json({ error: 'databaseId is required' });
    }
    const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
    const insights = await generateDatabaseInsights(req.user!.id, databaseId);
    dbStore.addLog(
      'AI Action (Smart Insights)',
      req.user!.email,
      'info',
      `Generated AI analytical insights and KPIs for "${targetDb?.name || databaseId}"`,
      req.user!.id,
      'AI'
    );
    res.json(insights);
  });

  app.get('/api/ai/insights/:databaseId', authenticateToken, async (req, res) => {
    const { databaseId } = req.params;
    const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
    const insights = await generateDatabaseInsights(req.user!.id, databaseId);
    dbStore.addLog(
      'AI Action (Smart Insights)',
      req.user!.email,
      'info',
      `Generated AI analytical insights and KPIs for "${targetDb?.name || databaseId}"`,
      req.user!.id,
      'AI'
    );
    res.json(insights);
  });

  // AI Data Cleaning Endpoints
  app.get('/api/ai/clean-data/:databaseId', authenticateToken, async (req, res) => {
    const { databaseId } = req.params;
    const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
    const analysis = await generateDataCleaningAnalysis(req.user!.id, databaseId);
    dbStore.addLog(
      'AI Action (Data Quality Audit)',
      req.user!.email,
      'info',
      `Scanned "${targetDb?.name || databaseId}" for duplicates, anomalies and missing values`,
      req.user!.id,
      'AI'
    );
    res.json(analysis);
  });

  app.post('/api/ai/clean-data', authenticateToken, async (req, res) => {
    const { databaseId } = req.body;
    if (!databaseId) {
      return res.status(400).json({ error: 'databaseId is required' });
    }
    const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
    const analysis = await generateDataCleaningAnalysis(req.user!.id, databaseId);
    dbStore.addLog(
      'AI Action (Data Quality Audit)',
      req.user!.email,
      'info',
      `Scanned "${targetDb?.name || databaseId}" for duplicates, anomalies and missing values`,
      req.user!.id,
      'AI'
    );
    res.json(analysis);
  });

  app.post('/api/ai/clean-data/apply', authenticateToken, async (req, res) => {
    const { databaseId, approvedFixes } = req.body;
    if (!databaseId || !Array.isArray(approvedFixes)) {
      return res.status(400).json({ error: 'databaseId and approvedFixes array are required' });
    }

    const userId = req.user!.id;
    const targetDb = dbStore.getDatabaseById(databaseId, userId);
    let appliedCount = 0;
    const deletedRecordIds: string[] = [];
    const modifiedRecordsMap = new Map<string, RecordItem>();

    for (const fix of approvedFixes) {
      if (!fix.approved) continue;

      if (fix.action === 'delete_duplicate') {
        const deleted = await dbStore.deleteRecord(fix.recordId, userId);
        if (deleted) {
          deletedRecordIds.push(fix.recordId);
          appliedCount++;
        }
      } else if (fix.action === 'update_field' || fix.action === 'fill_missing') {
        // Fetch current record state
        let targetRecord = modifiedRecordsMap.get(fix.recordId);
        if (!targetRecord) {
          const fetched = dbStore.getRecordById(fix.recordId, userId);
          if (fetched) {
            targetRecord = { ...fetched, data: { ...fetched.data } };
          }
        }

        if (targetRecord) {
          targetRecord.data[fix.fieldName] = fix.suggestedValue;
          targetRecord.updatedAt = new Date().toISOString();
          modifiedRecordsMap.set(fix.recordId, targetRecord);
          appliedCount++;
        }
      }
    }

    // Commit modified records to persistent store
    const updatedRecords: RecordItem[] = [];
    for (const [recId, rec] of modifiedRecordsMap.entries()) {
      const saved = await dbStore.updateRecord(recId, { data: rec.data, isArchived: rec.isArchived }, userId);
      if (saved) {
        updatedRecords.push(saved);
      }
    }

    dbStore.addLog(
      'AI Action (Data Cleaning Applied)',
      req.user!.email,
      'success',
      `Applied ${appliedCount} AI data cleaning fix(es) to "${targetDb?.name || databaseId}". Deleted ${deletedRecordIds.length} duplicate(s), updated ${updatedRecords.length} record(s).`,
      userId,
      'AI'
    );

    // Send notification (AI Data Cleaning completed)
    dbStore.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId,
      title: 'AI Data Cleaning Completed',
      message: `Applied ${appliedCount} data quality correction(s) to "${targetDb?.name || databaseId}". Deleted ${deletedRecordIds.length} duplicate(s), updated ${updatedRecords.length} record(s).`,
      type: 'ai',
      isRead: false,
      createdAt: new Date().toISOString(),
      databaseId: databaseId,
      link: `/database/${databaseId}`,
    });

    res.json({
      success: true,
      appliedCount,
      deletedRecordIds,
      updatedRecords,
      message: `Successfully applied ${appliedCount} data quality correction(s).`,
    });
  });

  // AI Executive Report Generator Endpoints
  app.get('/api/ai/report/:databaseId', authenticateToken, async (req, res) => {
    const { databaseId } = req.params;
    try {
      const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
      const report = await generateExecutiveAIReport(req.user!.id, databaseId);
      dbStore.addLog(
        'AI Action (Executive Report)',
        req.user!.email,
        'success',
        `Generated executive AI summary and KPI analysis for "${targetDb?.name || databaseId}"`,
        req.user!.id,
        'AI'
      );

      // Send notification (AI Report generated)
      dbStore.addNotification({
        id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: req.user!.id,
        title: 'AI Report Generated',
        message: `Executive AI Report & analytics KPI analysis for "${targetDb?.name || databaseId}" are ready.`,
        type: 'ai',
        isRead: false,
        createdAt: new Date().toISOString(),
        databaseId: databaseId,
        link: `/database/${databaseId}`,
      });

      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to generate AI report' });
    }
  });

  app.post('/api/ai/report', authenticateToken, async (req, res) => {
    const { databaseId } = req.body;
    if (!databaseId) {
      return res.status(400).json({ error: 'databaseId is required' });
    }
    try {
      const targetDb = dbStore.getDatabaseById(databaseId, req.user!.id);
      const report = await generateExecutiveAIReport(req.user!.id, databaseId);
      dbStore.addLog(
        'AI Action (Executive Report)',
        req.user!.email,
        'success',
        `Generated executive AI summary and KPI analysis for "${targetDb?.name || databaseId}"`,
        req.user!.id,
        'AI'
      );

      // Send notification (AI Report generated)
      dbStore.addNotification({
        id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: req.user!.id,
        title: 'AI Report Generated',
        message: `Executive AI Report & analytics KPI analysis for "${targetDb?.name || databaseId}" are ready.`,
        type: 'ai',
        isRead: false,
        createdAt: new Date().toISOString(),
        databaseId: databaseId,
        link: `/database/${databaseId}`,
      });

      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to generate AI report' });
    }
  });

  app.post('/api/ai/query', authenticateToken, async (req, res) => {
    const { prompt, databaseId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt string is required' });
    }

    try {
      console.log('[AI Query] Started:', prompt.slice(0, 40));
      const aiResult = await processAIQuery(prompt, req.user!.id, databaseId);
      console.log('[AI Query] Completed successfully');
      dbStore.addLog(
        'AI Action (Natural Language Query)',
        req.user!.email,
        'info',
        `Queried: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`,
        req.user!.id,
        'AI'
      );
      res.json(aiResult);
    } catch (error: any) {
      console.error('[AI Query] Error:', error?.message || error);
      dbStore.addLog(
        'AI Action Failed',
        req.user!.email,
        'error',
        `AI Query failed: ${error?.message || 'Unknown error'}`,
        req.user!.id,
        'AI'
      );
      res.status(500).json({ error: 'Failed to process AI query', details: error?.message });
    }
  });

  app.post('/api/ai/generate-database', authenticateToken, async (req, res) => {
    const { prompt, autoCreate } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required to generate database schema.' });
    }

    try {
      console.log('[AI Generate DB] Started:', prompt.slice(0, 40));
      const generated = await generateDatabaseWithAI(prompt, req.user!.id);

    if (autoCreate) {
      const slug = generated.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const newDb: DatabaseSchema = {
        id: 'db-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        userId: req.user!.id,
        name: generated.name,
        slug,
        description: generated.description,
        category: generated.category,
        icon: generated.icon,
        color: generated.color,
        fields: generated.fields,
        collaborators: [],
        shareLinks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await dbStore.addDatabase(newDb);

      // Add sample records
      const createdRecords: RecordItem[] = [];
      if (Array.isArray(generated.sampleRecords)) {
        for (const sample of generated.sampleRecords) {
          const rec: RecordItem = {
            id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            userId: req.user!.id,
            databaseId: newDb.id,
            data: sample,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isArchived: false,
          };
          await dbStore.addRecord(rec);
          createdRecords.push(rec);
        }
      }

      console.log('[AI Generate DB] Completed - auto-created');
      dbStore.addLog(
        'Database Created (AI Architect)',
        req.user!.email,
        'success',
        `Generated and auto-created AI database "${newDb.name}" with ${createdRecords.length} records.`,
        req.user!.id,
        'Database'
      );

      return res.status(201).json({
        database: newDb,
        records: createdRecords,
        message: `AI Database "${newDb.name}" generated and created successfully with ${createdRecords.length} sample records.`,
      });
    }

    console.log('[AI Generate DB] Completed - schema only');
    dbStore.addLog(
      'AI Action (Schema Blueprint)',
      req.user!.email,
      'info',
      `Architected schema blueprint for "${generated.name}" with ${generated.fields.length} fields`,
      req.user!.id,
      'AI'
    );

    res.json({ generated });
    } catch (error: any) {
      console.error('[AI Generate DB] Error:', error?.message || error);
      dbStore.addLog(
        'AI Generate DB Failed',
        req.user!.email,
        'error',
        `Database generation failed: ${error?.message || 'Unknown error'}`,
        req.user!.id,
        'AI'
      );
      res.status(500).json({ error: 'Failed to generate database schema', details: error?.message });
    }
  });


  // Admin & System Endpoints
  app.get('/api/admin/users', authenticateToken, (req, res) => {
    const sanitizedUsers = dbStore.users.map(sanitizeUser);
    res.json({ users: sanitizedUsers });
  });

  app.post('/api/admin/users/role', authenticateToken, async (req, res) => {
    const { userId, role } = req.body;
    const updatedUser = await dbStore.updateUser(userId, { role });
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    dbStore.addLog(
      'Role Updated',
      req.user!.email,
      'info',
      `Updated user ${updatedUser.email} role to ${role}`,
      req.user!.id
    );

    res.json({ user: sanitizeUser(updatedUser), message: 'Role updated' });
  });

  app.get('/api/admin/logs', authenticateToken, (req, res) => {
    const userLogs = dbStore.getLogsForUser(req.user!.id);
    res.json({ logs: userLogs });
  });

  app.get('/api/admin/stats', authenticateToken, (req, res) => {
    const userId = req.user!.id;
    const userDbs = dbStore.getDatabasesForUser(userId);
    const userRecs = dbStore.getRecordsForUser(userId, undefined, true);

    const totalDatabases = userDbs.length;
    const totalRecords = userRecs.filter((r) => !r.isArchived).length;
    const archivedRecords = userRecs.filter((r) => r.isArchived).length;
    const totalUsers = dbStore.users.length;
    const storageKB = Math.round((JSON.stringify(userRecs).length + JSON.stringify(userDbs).length) / 1024);

    res.json({
      totalDatabases,
      totalRecords,
      archivedRecords,
      totalUsers,
      storageKB,
      storageMB: (storageKB / 1024).toFixed(2),
    });
  });

  // Serve verification page on /verify (same origin as API, no CORS issues)
  app.get('/verify', (req, res) => {
    const verifyPath = path.join(process.cwd(), 'public', 'verify.html');
    res.sendFile(verifyPath, (err) => {
      if (err) res.status(404).send('Verification page not found. Run the agent to regenerate it.');
    });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Vite] Initializing Vite middleware for development...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/data/nexus_db.json',
            '**/dist/**',
            '**/*.log',
            '**/public/verify.html',
            '**/screenshots/**',
            '**/e2e-screenshots/**',
            '**/*.md',
            '**/e2e-*.mjs',
            '**/scratch/**',
          ],
        },
      },
      appType: 'spa',
    });
    // Use Vite middleware BEFORE static routes
    app.use(vite.middlewares);
    
    // Fallback to Vite's middleware for SPA routing (handles index.html)
    app.get('*', (req, res) => {
      // Let Vite handle this
      vite.middlewares(req, res, () => {
        res.status(404).send('Not found');
      });
    });
  } else {
    console.log('[Production] Serving static dist folder...');
    const distPath = path.join(process.cwd(), 'dist');
    // Serve static files from dist
    app.use(express.static(distPath, { maxAge: '1d', etag: false }));
    // SPA fallback: all non-file requests go to index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
          console.error('Error sending index.html:', err);
          res.status(500).send('Internal Server Error');
        }
      });
    });
  }

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ NexusDB AI server running at http://localhost:${PORT}`);
    console.log(`✓ Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`✓ Database: ${process.env.MONGODB_URI ? 'MongoDB Atlas' : 'Disk-based (JSON)'}\n`);
  });
}

startServer();
