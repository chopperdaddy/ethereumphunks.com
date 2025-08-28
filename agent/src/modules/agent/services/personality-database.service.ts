import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export interface PersonalityProfile {
  userId: string;
  traits: {
    profanityLevel: number; // 0-10 scale
    sarcasmLevel: number; // 0-10 scale
    helpfulness: number; // 0-10 scale
    patience: number; // 0-10 scale
    humor: number; // 0-10 scale
    casualness: number; // 0-10 scale
  };
  relationships: {
    trustLevel: number; // 0-10 scale
    interactionCount: number;
    lastSeen: Date;
    userType: 'new' | 'regular' | 'annoying' | 'favorite';
  };
  conversationMemory: {
    recentTopics: string[];
    preferences: Record<string, any>;
    quirks: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationContext {
  conversationId: string;
  userId: string;
  messageCount: number;
  topics: string[];
  mood: 'good' | 'neutral' | 'bad' | 'annoyed';
  lastActivity: Date;
}

@Injectable()
export class PersonalityDatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;

  constructor() {}

  onModuleInit() {
    this.initializeDatabase();
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
    }
  }

  private initializeDatabase() {
    // Create database directory if it doesn't exist
    const dbPath = this.getDbPath();
    const dbDir = join(process.cwd(), '.data');

    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    this.db.pragma('foreign_keys = ON');   // Enable foreign keys

    this.createTables();
    this.seedDefaultPersonality();
  }

  private createTables() {
    // Personality profiles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS personality_profiles (
        user_id TEXT PRIMARY KEY,
        profanity_level INTEGER DEFAULT 8,
        sarcasm_level INTEGER DEFAULT 9,
        helpfulness INTEGER DEFAULT 6,
        patience INTEGER DEFAULT 3,
        humor INTEGER DEFAULT 7,
        casualness INTEGER DEFAULT 9,
        trust_level INTEGER DEFAULT 5,
        interaction_count INTEGER DEFAULT 0,
        last_seen TEXT,
        user_type TEXT DEFAULT 'new',
        recent_topics TEXT DEFAULT '[]',
        preferences TEXT DEFAULT '{}',
        quirks TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conversation contexts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_contexts (
        conversation_id TEXT PRIMARY KEY,
        user_id TEXT,
        message_count INTEGER DEFAULT 0,
        topics TEXT DEFAULT '[]',
        mood TEXT DEFAULT 'neutral',
        last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES personality_profiles (user_id)
      )
    `);

    // Personality memories table (for specific memorable interactions)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS personality_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        memory_type TEXT, -- 'funny', 'annoying', 'helpful', 'stupid_question'
        content TEXT,
        importance INTEGER DEFAULT 5, -- 1-10 scale
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES personality_profiles (user_id)
      )
    `);

    console.log('✅ Personality database tables created/verified');
  }

  private seedDefaultPersonality() {
    // Create the default "Japhar" personality template
    const defaultPersonality = this.db.prepare(`
      INSERT OR IGNORE INTO personality_profiles (
        user_id, profanity_level, sarcasm_level, helpfulness,
        patience, humor, casualness, user_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // This is the base personality that new users inherit
    defaultPersonality.run('_default', 8, 9, 6, 3, 7, 9, 'template');

    console.log('✅ Default personality template seeded');
  }

  private getDbPath(): string {
    return join(process.cwd(), '.data', 'personality.db');
  }

  // Get or create personality profile for a user
  getPersonalityProfile(userId: string): PersonalityProfile {
    let profile = this.db.prepare('SELECT * FROM personality_profiles WHERE user_id = ?').get(userId) as any;

    if (!profile) {
      // Create new profile based on default template
      const defaultProfile = this.db.prepare('SELECT * FROM personality_profiles WHERE user_id = ?').get('_default') as any;

      const insertProfile = this.db.prepare(`
        INSERT INTO personality_profiles (
          user_id, profanity_level, sarcasm_level, helpfulness,
          patience, humor, casualness, trust_level, user_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertProfile.run(
        userId,
        defaultProfile.profanity_level,
        defaultProfile.sarcasm_level,
        defaultProfile.helpfulness,
        defaultProfile.patience,
        defaultProfile.humor,
        defaultProfile.casualness,
        5, // Default trust level
        'new'
      );

      profile = this.db.prepare('SELECT * FROM personality_profiles WHERE user_id = ?').get(userId) as any;
    }

    return this.mapDbToPersonality(profile);
  }

  // Update personality based on interaction
  updatePersonalityFromInteraction(userId: string, interactionType: string, userMessage: string) {
    const updateProfile = this.db.prepare(`
      UPDATE personality_profiles
      SET
        interaction_count = interaction_count + 1,
        last_seen = ?,
        updated_at = CURRENT_TIMESTAMP,
        trust_level = CASE
          WHEN ? = 'positive' THEN MIN(trust_level + 1, 10)
          WHEN ? = 'negative' THEN MAX(trust_level - 1, 0)
          ELSE trust_level
        END,
        patience = CASE
          WHEN ? = 'repetitive' THEN MAX(patience - 1, 0)
          WHEN ? = 'clear' THEN MIN(patience + 1, 10)
          ELSE patience
        END
      WHERE user_id = ?
    `);

    updateProfile.run(
      new Date().toISOString(),
      interactionType,
      interactionType,
      interactionType,
      interactionType,
      userId
    );
  }

  // Get or create conversation context
  getConversationContext(conversationId: string, userId: string): ConversationContext {
    let context = this.db.prepare('SELECT * FROM conversation_contexts WHERE conversation_id = ?').get(conversationId) as any;

    if (!context) {
      const insertContext = this.db.prepare(`
        INSERT INTO conversation_contexts (conversation_id, user_id, mood)
        VALUES (?, ?, ?)
      `);

      insertContext.run(conversationId, userId, 'neutral');
      context = this.db.prepare('SELECT * FROM conversation_contexts WHERE conversation_id = ?').get(conversationId) as any;
    }

    return {
      conversationId: context.conversation_id,
      userId: context.user_id,
      messageCount: context.message_count,
      topics: JSON.parse(context.topics || '[]'),
      mood: context.mood as any,
      lastActivity: new Date(context.last_activity)
    };
  }

  // Update conversation context
  updateConversationContext(conversationId: string, updates: Partial<ConversationContext>) {
    const updateContext = this.db.prepare(`
      UPDATE conversation_contexts
      SET
        message_count = message_count + 1,
        topics = ?,
        mood = ?,
        last_activity = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
    `);

    updateContext.run(
      JSON.stringify(updates.topics || []),
      updates.mood || 'neutral',
      conversationId
    );
  }

  // Add a memorable interaction
  addMemory(userId: string, memoryType: string, content: string, importance: number = 5) {
    const insertMemory = this.db.prepare(`
      INSERT INTO personality_memories (user_id, memory_type, content, importance)
      VALUES (?, ?, ?, ?)
    `);

    insertMemory.run(userId, memoryType, content, importance);

    // Keep only the 50 most important memories per user
    const cleanup = this.db.prepare(`
      DELETE FROM personality_memories
      WHERE user_id = ?
      AND id NOT IN (
        SELECT id FROM personality_memories
        WHERE user_id = ?
        ORDER BY importance DESC, created_at DESC
        LIMIT 50
      )
    `);

    cleanup.run(userId, userId);
  }

  // Get user memories
  getMemories(userId: string, memoryType?: string): Array<{content: string, importance: number, createdAt: Date}> {
    const query = memoryType
      ? 'SELECT * FROM personality_memories WHERE user_id = ? AND memory_type = ? ORDER BY importance DESC, created_at DESC LIMIT 10'
      : 'SELECT * FROM personality_memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT 10';

    const memories = memoryType
      ? this.db.prepare(query).all(userId, memoryType)
      : this.db.prepare(query).all(userId);

    return (memories as any[]).map(m => ({
      content: m.content,
      importance: m.importance,
      createdAt: new Date(m.created_at)
    }));
  }

  private mapDbToPersonality(dbRow: any): PersonalityProfile {
    return {
      userId: dbRow.user_id,
      traits: {
        profanityLevel: dbRow.profanity_level,
        sarcasmLevel: dbRow.sarcasm_level,
        helpfulness: dbRow.helpfulness,
        patience: dbRow.patience,
        humor: dbRow.humor,
        casualness: dbRow.casualness,
      },
      relationships: {
        trustLevel: dbRow.trust_level,
        interactionCount: dbRow.interaction_count,
        lastSeen: dbRow.last_seen ? new Date(dbRow.last_seen) : new Date(),
        userType: dbRow.user_type,
      },
      conversationMemory: {
        recentTopics: JSON.parse(dbRow.recent_topics || '[]'),
        preferences: JSON.parse(dbRow.preferences || '{}'),
        quirks: JSON.parse(dbRow.quirks || '[]'),
      },
      createdAt: new Date(dbRow.created_at),
      updatedAt: new Date(dbRow.updated_at),
    };
  }
}
