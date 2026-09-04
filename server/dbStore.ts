import fs from 'fs';
import path from 'path';
import { MongoClient, Db } from 'mongodb';
import { DatabaseSchema, RecordItem, SystemLog, User, NotificationItem, Collaborator, ShareLink, Role } from '../src/types.js';

export interface StoredUser extends User {
  passwordHash?: string;
  resetToken?: string;
  resetTokenExpiresAt?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'nexus_db.json');

class Store {
  users: StoredUser[] = [];
  databases: DatabaseSchema[] = [];
  records: RecordItem[] = [];
  logs: SystemLog[] = [];
  notifications: NotificationItem[] = [];
  
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private isMongoConnected = false;

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
    // Initialize MongoDB asynchronously (does not block server startup)
    this.initMongo().catch((err) => {
      console.error('[CRITICAL] MongoDB initialization failed:', err.message);
    });
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error('Error creating data dir:', err);
      }
    }
  }

  private loadFromDisk() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.users = parsed.users || [];
        this.databases = parsed.databases || [];
        this.records = parsed.records || [];
        this.logs = parsed.logs || [];
        this.notifications = parsed.notifications || [];
      } catch (e) {
        console.error('Error reading nexus_db.json from disk:', e);
      }
    }
  }

  private async saveToDisk() {
    try {
      this.ensureDataDir();
      const payload = {
        users: this.users,
        databases: this.databases,
        records: this.records,
        logs: this.logs,
        notifications: this.notifications,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving to disk:', e);
    }
  }

  private async initMongo() {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.info('[INFO] MONGODB_URI not set. Operating in disk-only mode.');
      return;
    }

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`[MongoDB] Attempting connection (attempt ${retryCount + 1}/${maxRetries})...`);
        
        this.mongoClient = new MongoClient(mongoUri, {
          // Atlas-compatible configuration
          retryWrites: true,
          retryReads: true,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 10000,
          family: 4, // IPv4 only (resolves some SSL issues)
          // Remove explicit tls: false to allow URI to dictate TLS
        });
        
        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db('nexusdb_ai');
        
        // Verify connection with ping
        await this.mongoDb.admin().ping();
        
        this.isMongoConnected = true;
        console.log('[✓ MongoDB] Successfully connected to MongoDB Atlas!');

        // Sync MongoDB into memory/disk
        try {
          const usersCol = await this.mongoDb.collection<StoredUser>('users').find().toArray();
          const dbCol = await this.mongoDb.collection<DatabaseSchema>('databases').find().toArray();
          const recCol = await this.mongoDb.collection<RecordItem>('records').find().toArray();
          const logCol = await this.mongoDb.collection<SystemLog>('logs').find().toArray();
          const notifCol = await this.mongoDb.collection<NotificationItem>('notifications').find().toArray();

          if (usersCol.length > 0) {
            const mongoUsers = usersCol.map(({ _id, ...rest }: any) => rest);
            const userMap = new Map<string, StoredUser>();
            this.users.forEach((u) => userMap.set(u.id, u));
            mongoUsers.forEach((u) => userMap.set(u.id, u));
            this.users = Array.from(userMap.values());
          }
          if (dbCol.length > 0) {
            const mongoDbs = dbCol.map(({ _id, ...rest }: any) => rest);
            const dbMap = new Map<string, DatabaseSchema>();
            this.databases.forEach((d) => dbMap.set(d.id, d));
            mongoDbs.forEach((d) => dbMap.set(d.id, d));
            this.databases = Array.from(dbMap.values());
          }
          if (recCol.length > 0) {
            const mongoRecs = recCol.map(({ _id, ...rest }: any) => rest);
            const recMap = new Map<string, RecordItem>();
            this.records.forEach((r) => recMap.set(r.id, r));
            mongoRecs.forEach((r) => recMap.set(r.id, r));
            this.records = Array.from(recMap.values());
          }
          if (logCol.length > 0) {
            const mongoLogs = logCol.map(({ _id, ...rest }: any) => rest);
            const logMap = new Map<string, SystemLog>();
            this.logs.forEach((l) => logMap.set(l.id, l));
            mongoLogs.forEach((l) => logMap.set(l.id, l));
            this.logs = Array.from(logMap.values()).slice(0, 500);
          }
          if (notifCol.length > 0) {
            const mongoNotifs = notifCol.map(({ _id, ...rest }: any) => rest);
            const notifMap = new Map<string, NotificationItem>();
            this.notifications.forEach((n) => notifMap.set(n.id, n));
            mongoNotifs.forEach((n) => notifMap.set(n.id, n));
            this.notifications = Array.from(notifMap.values()).slice(0, 200);
          }

          console.log(`[✓ MongoDB] Synced: ${usersCol.length} users, ${dbCol.length} databases, ${recCol.length} records`);
          this.saveToDisk();
        } catch (syncErr: any) {
          console.error('[⚠ MongoDB] Sync error (data not loaded from MongoDB, using disk):', syncErr.message);
          this.isMongoConnected = false;
          return;
        }
        
        return; // Success, exit retry loop
      } catch (err: any) {
        retryCount++;
        const errorMsg = err?.message || String(err);
        const errorCode = err?.code || err?.codeName || 'UNKNOWN';
        
        console.error(`[✗ MongoDB] Connection attempt ${retryCount} failed (${errorCode}): ${errorMsg}`);
        
        if (retryCount < maxRetries) {
          const delayMs = 1000 * Math.pow(2, retryCount - 1); // Exponential backoff
          console.log(`[MongoDB] Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    console.warn(`[⚠ MongoDB] Failed to connect after ${maxRetries} attempts. Operating in disk-only mode.`);
    this.isMongoConnected = false;
  }

  private async syncMongo(collectionName: 'users' | 'databases' | 'records' | 'logs' | 'notifications', item: any) {
    // Always save to disk for local resilience
    this.saveToDisk();
    
    // Attempt MongoDB sync if connected
    if (!this.isMongoConnected || !this.mongoDb) {
      return;
    }

    try {
      const col = this.mongoDb.collection(collectionName);
      await col.replaceOne({ id: item.id }, item, { upsert: true });
    } catch (e: any) {
      console.error(`[✗ MongoDB Sync] Failed to sync ${collectionName} (${item.id}):`, e.message);
      // Continue despite MongoDB errors - disk save is primary
    }
  }

  private async removeMongo(collectionName: 'users' | 'databases' | 'records' | 'logs' | 'notifications', id: string) {
    // Always save to disk for local resilience
    this.saveToDisk();
    
    // Attempt MongoDB removal if connected
    if (!this.isMongoConnected || !this.mongoDb) {
      return;
    }

    try {
      const col = this.mongoDb.collection(collectionName);
      await col.deleteOne({ id });
    } catch (e: any) {
      console.error(`[✗ MongoDB Sync] Failed to remove from ${collectionName} (${id}):`, e.message);
      // Continue despite MongoDB errors - disk deletion is primary
    }
  }

  // --- Users ---
  getUserByEmail(email: string): StoredUser | undefined {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id: string): StoredUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  getUserByResetToken(token: string): StoredUser | undefined {
    return this.users.find((u) => u.resetToken === token);
  }

  async addUser(user: StoredUser): Promise<StoredUser> {
    this.users.push(user);
    await this.syncMongo('users', user);
    return user;
  }

  async updateUser(id: string, updates: Partial<StoredUser>): Promise<StoredUser | null> {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.users[idx] = { ...this.users[idx], ...updates };
    await this.syncMongo('users', this.users[idx]);
    return this.users[idx];
  }

  // --- Notifications ---
  getNotificationsForUser(userId: string): NotificationItem[] {
    return this.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addNotification(notif: NotificationItem): Promise<NotificationItem> {
    this.notifications.unshift(notif);
    if (this.notifications.length > 200) this.notifications.pop();
    await this.syncMongo('notifications', notif);
    return notif;
  }

  async markNotificationAsRead(id: string, userId: string): Promise<boolean> {
    const notif = this.notifications.find((n) => n.id === id && n.userId === userId);
    if (!notif) return false;
    notif.isRead = true;
    await this.syncMongo('notifications', notif);
    return true;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    let updated = false;
    for (const n of this.notifications) {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        updated = true;
        await this.syncMongo('notifications', n);
      }
    }
    return updated;
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const idx = this.notifications.findIndex((n) => n.id === id && n.userId === userId);
    if (idx === -1) return false;
    this.notifications.splice(idx, 1);
    await this.removeMongo('notifications', id);
    return true;
  }

  async clearNotificationsForUser(userId: string): Promise<number> {
    const beforeCount = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.userId !== userId);
    this.saveToDisk();
    return beforeCount - this.notifications.length;
  }

  // --- Databases ---
  getDatabasesForUser(userId: string): DatabaseSchema[] {
    const user = this.getUserById(userId);
    const userEmail = user?.email.toLowerCase() || '';

    const list: DatabaseSchema[] = [];

    for (const db of this.databases) {
      const isFav = Array.isArray(db.favoriteUserIds) && db.favoriteUserIds.includes(userId);

      // Owned database
      if (db.userId === userId) {
        list.push({
          ...db,
          isFavorite: isFav,
          isSharedWithMe: false,
          myRole: 'Admin',
        });
      } else {
        // Check if user is collaborator
        const col = (db.collaborators || []).find(
          (c) => c.userId === userId || c.email.toLowerCase() === userEmail
        );
        if (col) {
          list.push({
            ...db,
            isFavorite: isFav,
            isSharedWithMe: true,
            myRole: col.role,
          });
        }
      }
    }

    return list;
  }

  async toggleFavorite(databaseId: string, userId: string): Promise<{ isFavorite: boolean } | null> {
    const db = this.getRawDatabaseById(databaseId);
    if (!db) return null;

    if (!Array.isArray(db.favoriteUserIds)) {
      db.favoriteUserIds = [];
    }

    const idx = db.favoriteUserIds.indexOf(userId);
    let isFavorite = false;
    if (idx >= 0) {
      db.favoriteUserIds.splice(idx, 1);
      isFavorite = false;
    } else {
      db.favoriteUserIds.push(userId);
      isFavorite = true;
    }

    await this.syncMongo('databases', db);
    return { isFavorite };
  }

  getDatabaseById(id: string, userId: string): DatabaseSchema | undefined {
    const userDbs = this.getDatabasesForUser(userId);
    return userDbs.find((d) => d.id === id);
  }

  getRawDatabaseById(id: string): DatabaseSchema | undefined {
    return this.databases.find((d) => d.id === id);
  }

  async addDatabase(db: DatabaseSchema): Promise<DatabaseSchema> {
    if (!db.collaborators) db.collaborators = [];
    if (!db.shareLinks) db.shareLinks = [];
    this.databases.push(db);
    await this.syncMongo('databases', db);
    return db;
  }

  async updateDatabase(id: string, updates: Partial<DatabaseSchema>, userId: string): Promise<DatabaseSchema | null> {
    const db = this.getRawDatabaseById(id);
    if (!db) return null;

    // Check ownership or admin collaborator
    const isOwner = db.userId === userId;
    const isCollabAdmin = (db.collaborators || []).some(
      (c) => c.userId === userId && c.role === 'Admin'
    );

    if (!isOwner && !isCollabAdmin) return null;

    const idx = this.databases.findIndex((d) => d.id === id);
    if (idx === -1) return null;

    this.databases[idx] = {
      ...this.databases[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.syncMongo('databases', this.databases[idx]);
    return this.databases[idx];
  }

  async deleteDatabase(id: string, userId: string): Promise<boolean> {
    const db = this.getRawDatabaseById(id);
    if (!db || db.userId !== userId) return false; // Only owner can delete database

    const idx = this.databases.findIndex((d) => d.id === id);
    if (idx === -1) return false;

    this.databases.splice(idx, 1);
    await this.removeMongo('databases', id);

    // Also remove associated records
    const recordsToRemove = this.records.filter((r) => r.databaseId === id);
    this.records = this.records.filter((r) => r.databaseId !== id);
    for (const rec of recordsToRemove) {
      await this.removeMongo('records', rec.id);
    }

    this.saveToDisk();
    return true;
  }

  // Collaboration Helpers
  async addCollaborator(databaseId: string, collaborator: Collaborator, ownerUserId: string): Promise<DatabaseSchema | null> {
    const db = this.getRawDatabaseById(databaseId);
    if (!db || db.userId !== ownerUserId) return null;

    if (!db.collaborators) db.collaborators = [];

    // Remove existing if any, then push new
    db.collaborators = db.collaborators.filter((c) => c.email.toLowerCase() !== collaborator.email.toLowerCase());
    db.collaborators.push(collaborator);

    await this.syncMongo('databases', db);
    return db;
  }

  async removeCollaborator(databaseId: string, targetEmail: string, ownerUserId: string): Promise<DatabaseSchema | null> {
    const db = this.getRawDatabaseById(databaseId);
    if (!db || db.userId !== ownerUserId) return null;

    if (db.collaborators) {
      db.collaborators = db.collaborators.filter((c) => c.email.toLowerCase() !== targetEmail.toLowerCase());
      await this.syncMongo('databases', db);
    }
    return db;
  }

  async updateCollaboratorRole(databaseId: string, targetEmail: string, newRole: Role, ownerUserId: string): Promise<DatabaseSchema | null> {
    const db = this.getRawDatabaseById(databaseId);
    if (!db || db.userId !== ownerUserId) return null;

    if (db.collaborators) {
      const col = db.collaborators.find((c) => c.email.toLowerCase() === targetEmail.toLowerCase());
      if (col) {
        col.role = newRole;
        await this.syncMongo('databases', db);
      }
    }
    return db;
  }

  // Share Links
  async addShareLink(databaseId: string, shareLink: ShareLink, userId: string): Promise<DatabaseSchema | null> {
    const db = this.getRawDatabaseById(databaseId);
    if (!db || db.userId !== userId) return null;

    if (!db.shareLinks) db.shareLinks = [];
    db.shareLinks.unshift(shareLink);

    await this.syncMongo('databases', db);
    return db;
  }

  async updateShareLink(databaseId: string, linkId: string, updates: Partial<ShareLink>, userId: string): Promise<DatabaseSchema | null> {
    const db = this.getRawDatabaseById(databaseId);
    if (!db || db.userId !== userId) return null;

    if (db.shareLinks) {
      const linkIdx = db.shareLinks.findIndex((l) => l.id === linkId);
      if (linkIdx !== -1) {
        db.shareLinks[linkIdx] = { ...db.shareLinks[linkIdx], ...updates };
        await this.syncMongo('databases', db);
      }
    }
    return db;
  }

  async deleteShareLink(databaseId: string, linkId: string, userId: string): Promise<DatabaseSchema | null> {
    const db = this.getRawDatabaseById(databaseId);
    if (!db || db.userId !== userId) return null;

    if (db.shareLinks) {
      db.shareLinks = db.shareLinks.filter((l) => l.id !== linkId);
      await this.syncMongo('databases', db);
    }
    return db;
  }

  getDatabaseByShareToken(token: string): { db: DatabaseSchema; shareLink: ShareLink } | null {
    for (const db of this.databases) {
      if (db.shareLinks) {
        const link = db.shareLinks.find((l) => l.token === token && l.active);
        if (link) {
          // Check expiration
          if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
            return null;
          }
          // Check max uses
          if (link.maxUses && link.currentUses >= link.maxUses) {
            return null;
          }
          return { db, shareLink: link };
        }
      }
    }
    return null;
  }

  // --- Records ---
  getRecordsForUser(userId: string, databaseId?: string, includeArchived?: boolean): RecordItem[] {
    const userDbs = this.getDatabasesForUser(userId);
    const accessibleDbIds = userDbs.map((d) => d.id);

    let recs = this.records.filter((r) => r.userId === userId || accessibleDbIds.includes(r.databaseId));

    if (databaseId) {
      recs = recs.filter((r) => r.databaseId === databaseId);
    }
    if (!includeArchived) {
      recs = recs.filter((r) => !r.isArchived);
    }
    return recs;
  }

  getRecordById(id: string, userId: string): RecordItem | undefined {
    const accessibleRecords = this.getRecordsForUser(userId, undefined, true);
    return accessibleRecords.find((r) => r.id === id);
  }

  async addRecord(record: RecordItem): Promise<RecordItem> {
    this.records.unshift(record);
    await this.syncMongo('records', record);
    return record;
  }

  async updateRecord(id: string, updates: Partial<RecordItem>, userId: string): Promise<RecordItem | null> {
    const dbRec = this.records.find((r) => r.id === id);
    if (!dbRec) return null;

    // Check permissions
    const db = this.getDatabaseById(dbRec.databaseId, userId);
    if (!db) return null;

    if (db.isSharedWithMe && db.myRole === 'Viewer') {
      return null; // Viewers cannot update
    }

    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.records[idx] = {
      ...this.records[idx],
      ...updates,
      data: updates.data !== undefined ? updates.data : this.records[idx].data,
      isArchived: updates.isArchived !== undefined ? updates.isArchived : this.records[idx].isArchived,
      updatedAt: new Date().toISOString(),
    };
    await this.syncMongo('records', this.records[idx]);
    return this.records[idx];
  }

  async deleteRecord(id: string, userId: string): Promise<boolean> {
    const dbRec = this.records.find((r) => r.id === id);
    if (!dbRec) return false;

    const db = this.getDatabaseById(dbRec.databaseId, userId);
    if (!db) return false;

    if (db.isSharedWithMe && db.myRole === 'Viewer') {
      return false; // Viewers cannot delete
    }

    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.records.splice(idx, 1);
    await this.removeMongo('records', id);
    return true;
  }

  async bulkDeleteRecords(recordIds: string[], userId: string): Promise<number> {
    let count = 0;
    const toKeep: RecordItem[] = [];
    for (const r of this.records) {
      if (recordIds.includes(r.id)) {
        const db = this.getDatabaseById(r.databaseId, userId);
        if (db && (!db.isSharedWithMe || db.myRole !== 'Viewer')) {
          count++;
          await this.removeMongo('records', r.id);
          continue;
        }
      }
      toKeep.push(r);
    }
    this.records = toKeep;
    this.saveToDisk();
    return count;
  }

  async bulkArchiveRecords(recordIds: string[], archive: boolean, userId: string): Promise<number> {
    let count = 0;
    for (const r of this.records) {
      if (recordIds.includes(r.id)) {
        const db = this.getDatabaseById(r.databaseId, userId);
        if (db && (!db.isSharedWithMe || db.myRole !== 'Viewer')) {
          r.isArchived = archive;
          r.updatedAt = new Date().toISOString();
          count++;
          await this.syncMongo('records', r);
        }
      }
    }
    return count;
  }

  async bulkUpdateRecords(recordIds: string[], fieldName: string, fieldValue: any, userId: string): Promise<number> {
    let count = 0;
    for (const r of this.records) {
      if (recordIds.includes(r.id)) {
        const db = this.getDatabaseById(r.databaseId, userId);
        if (db && (!db.isSharedWithMe || db.myRole !== 'Viewer')) {
          r.data = { ...r.data, [fieldName]: fieldValue };
          r.updatedAt = new Date().toISOString();
          count++;
          await this.syncMongo('records', r);
        }
      }
    }
    this.saveToDisk();
    return count;
  }

  async clearUserWorkspace(userId: string) {
    this.databases = this.databases.filter((d) => d.userId !== userId);
    this.records = this.records.filter((r) => r.userId !== userId);
    this.saveToDisk();
  }

  // --- System Logs ---
  getLogsForUser(userId: string): SystemLog[] {
    return this.logs.filter((l) => l.userId === userId || !l.userId);
  }

  clearLogsForUser(userId: string) {
    this.logs = this.logs.filter((l) => l.userId && l.userId !== userId);
    this.saveToDisk();
  }

  addLog(
    action: string,
    userEmail: string,
    type: 'info' | 'success' | 'warning' | 'error',
    details: string,
    userId?: string,
    category: string = 'System'
  ): SystemLog {
    const log: SystemLog = {
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      userId,
      timestamp: new Date().toISOString(),
      action,
      user: userEmail,
      type,
      details,
      category,
    };
    this.logs.unshift(log);
    if (this.logs.length > 500) this.logs.pop();
    this.syncMongo('logs', log);
    return log;
  }

  // --- Global Search ---
  searchAll(query: string, userId: string) {
    if (!query || !query.trim()) return { databases: [], records: [] };

    const q = query.trim().toLowerCase();
    const userDbs = this.getDatabasesForUser(userId);
    const userRecs = this.getRecordsForUser(userId, undefined, true);

    const matchingDatabases = userDbs.filter(
      (db) =>
        db.name.toLowerCase().includes(q) ||
        db.description.toLowerCase().includes(q) ||
        db.category.toLowerCase().includes(q)
    );

    const matchingRecords = userRecs.filter((rec) => {
      const db = userDbs.find((d) => d.id === rec.databaseId);
      const dbName = db ? db.name : '';
      const dataStr = Object.values(rec.data || {})
        .map((v) => String(v))
        .join(' ')
        .toLowerCase();
      return dataStr.includes(q) || dbName.toLowerCase().includes(q);
    });

    return {
      databases: matchingDatabases.slice(0, 5),
      records: matchingRecords.slice(0, 10).map((r) => {
        const db = userDbs.find((d) => d.id === r.databaseId);
        return {
          ...r,
          databaseName: db ? db.name : 'Database',
        };
      }),
    };
  }
}

export const dbStore = new Store();

