import { Injectable, OnModuleInit } from '@nestjs/common';

import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { MemorySaver } from '@langchain/langgraph-checkpoint';

import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { CompiledStateGraph, MessagesAnnotation } from '@langchain/langgraph';

import { PersonalityService } from './personality.service';

interface DatabaseSchema {
  tables: Array<{
    name: string;
    schema: string;
    columns?: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  }>;
  relationships: string[];
  lastUpdated: Date;
}

@Injectable()
export class LangchainService implements OnModuleInit {

  private initializedThreads = new Set<string>();
  private cachedSchema: DatabaseSchema | null = null;

  private agent: CompiledStateGraph<
    typeof MessagesAnnotation.State,
    typeof MessagesAnnotation.Update,
    any,
    typeof MessagesAnnotation.spec,
    typeof MessagesAnnotation.spec
  >;

  constructor(
    private readonly personalityService: PersonalityService
  ) {}

  async onModuleInit() {
    await this.createAgent();
  }

  private async loadDatabaseSchema(client: MultiServerMCPClient): Promise<DatabaseSchema> {
    console.log('📊 Loading database schema dynamically...');

    try {
      const tools = await client.getTools();

      // Find the relevant MCP tools
      const listTablesTool = tools.find(t => t.name === 'mcp__supabase__list_tables');
      const executeSqlTool = tools.find(t => t.name === 'mcp__supabase__execute_sql');

      if (!listTablesTool || !executeSqlTool) {
        throw new Error('Required MCP tools not available');
      }

      console.log('🔍 Discovering database tables...');

      // Get all tables using MCP tool directly
      const tablesResult = await listTablesTool.invoke({ schemas: ['public'] });
      console.log('📋 Tables result:', tablesResult);

      // Get column information for key tables
      const columnQuery = `
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name IN ('ethscriptions', 'ethscriptions_sepolia', 'listings', 'listings_sepolia', 'events', 'events_sepolia', 'bids', 'bids_sepolia')
        ORDER BY table_name, ordinal_position;
      `;

      console.log('🔍 Getting column information...');
      const columnsResult = await executeSqlTool.invoke({ query: columnQuery });
      console.log('📊 Columns result:', JSON.stringify(columnsResult).substring(0, 500) + '...');

      // Parse the results to build schema
      const schema: DatabaseSchema = {
        tables: [],
        relationships: [
          'ethscriptions.hashId -> listings.hashId',
          'ethscriptions.hashId -> events.hashId',
          'ethscriptions.hashId -> bids.hashId',
          'ethscriptions_sepolia.hashId -> listings_sepolia.hashId',
          'ethscriptions_sepolia.hashId -> events_sepolia.hashId',
          'ethscriptions_sepolia.hashId -> bids_sepolia.hashId',
        ],
        lastUpdated: new Date()
      };

      // Parse tables from the result
      if (typeof tablesResult === 'object' && tablesResult) {
        const tablesData = Array.isArray(tablesResult) ? tablesResult :
                          'data' in tablesResult ? tablesResult.data :
                          Object.values(tablesResult).find(v => Array.isArray(v)) || [];

        if (Array.isArray(tablesData)) {
          schema.tables = tablesData
            .filter((table: any) =>
              table &&
              typeof table === 'object' &&
              'table_name' in table &&
              ['ethscriptions', 'listings', 'events', 'bids'].some(prefix =>
                table.table_name === prefix || table.table_name === `${prefix}_sepolia`
              )
            )
            .map((table: any) => ({
              name: table.table_name,
              schema: table.table_schema || 'public',
              columns: [] // Will be populated from columns query
            }));
        }
      }

      // Parse columns from the result and add to tables
      if (typeof columnsResult === 'object' && columnsResult) {
        const columnsData = Array.isArray(columnsResult) ? columnsResult :
                           'data' in columnsResult ? columnsResult.data :
                           Object.values(columnsResult).find(v => Array.isArray(v)) || [];

        if (Array.isArray(columnsData)) {
          columnsData.forEach((col: any) => {
            if (col && typeof col === 'object' && 'table_name' in col && 'column_name' in col) {
              const table = schema.tables.find(t => t.name === col.table_name);
              if (table) {
                if (!table.columns) table.columns = [];
                table.columns.push({
                  name: col.column_name,
                  type: col.data_type || 'unknown',
                  nullable: col.is_nullable === 'YES'
                });
              }
            }
          });
        }
      }

      // Fallback if no tables were found dynamically
      if (schema.tables.length === 0) {
        console.log('⚠️ No tables found dynamically, using fallback list');
        schema.tables = [
          { name: 'ethscriptions', schema: 'public' },
          { name: 'listings', schema: 'public' },
          { name: 'events', schema: 'public' },
          { name: 'bids', schema: 'public' },
          { name: 'ethscriptions_sepolia', schema: 'public' },
          { name: 'listings_sepolia', schema: 'public' },
          { name: 'events_sepolia', schema: 'public' },
          { name: 'bids_sepolia', schema: 'public' },
        ];
      }

      console.log('✅ Database schema loaded dynamically:', {
        tableCount: schema.tables.length,
        tablesWithColumns: schema.tables.filter(t => t.columns && t.columns.length > 0).length,
        relationshipCount: schema.relationships.length
      });

      return schema;
    } catch (error) {
      console.error('❌ Failed to load database schema dynamically:', error);
      // Return a basic fallback schema
      return {
        tables: [
          { name: 'ethscriptions', schema: 'public' },
          { name: 'listings', schema: 'public' },
          { name: 'events', schema: 'public' },
          { name: 'bids', schema: 'public' },
          { name: 'ethscriptions_sepolia', schema: 'public' },
          { name: 'listings_sepolia', schema: 'public' },
          { name: 'events_sepolia', schema: 'public' },
          { name: 'bids_sepolia', schema: 'public' },
        ],
        relationships: [],
        lastUpdated: new Date()
      };
    }
  }

  private async createAgent() {
    const useLocalLLM = Number(process.env.USE_LOCAL_LLM);
    const agentModel = useLocalLLM
      ? new ChatOllama({
          model: process.env.LOCAL_LLM_MODEL,
          baseUrl: process.env.OLLAMA_BASE_URL,
        })
      : new ChatOpenAI({
          maxTokens: 4096,
          model: 'o4-mini',
          reasoning: {
            effort: 'low',
          },
          apiKey: process.env.OPENAI_API_KEY,
        });

    const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? '';
    const projectRef = process.env.SUPABASE_PROJECT_REF ?? '';

    const client = new MultiServerMCPClient({
      mcpServers: {
        supabase: {
          command: 'npx',
          args: [
            '-y',
            '@supabase/mcp-server-supabase@latest',
            '--read-only',
            '--access-token',
            accessToken,
            '--project-ref',
            projectRef
          ]
        },
      },
    });

    const agentCheckpointer = new MemorySaver();

    // Debug available MCP tools
    try {
      console.log('🔧 Connecting to MCP servers...');
      const tools = await client.getTools();
      console.log('✅ Available MCP tools:', tools.map(t => t.name));

      try {
        this.cachedSchema = await this.loadDatabaseSchema(client);
      } catch (schemaError) {
        console.error('❌ Schema loading failed, using fallback:', schemaError);
        this.cachedSchema = {
          tables: [
            { name: 'ethscriptions', schema: 'public' },
            { name: 'listings', schema: 'public' },
            { name: 'events', schema: 'public' },
            { name: 'bids', schema: 'public' },
            { name: 'ethscriptions_sepolia', schema: 'public' },
            { name: 'listings_sepolia', schema: 'public' },
            { name: 'events_sepolia', schema: 'public' },
            { name: 'bids_sepolia', schema: 'public' },
          ],
          relationships: [],
          lastUpdated: new Date()
        };
      }

      // Test the actual database connection on startup
      try {
        console.log('🧪 Testing database connection...');
        // Create a test agent just for startup testing
        const testAgent = createReactAgent({
          llm: agentModel,
          tools: tools,
          checkpointSaver: agentCheckpointer,
        });

        const testResponse = await testAgent.invoke({
          messages: [{
            role: 'user',
            content: 'Test database connection'
          }]
        }, { configurable: { thread_id: 'startup-test' } });

        console.log('✅ Database connection test completed');
        console.log('📊 Test response:', testResponse.messages[testResponse.messages.length - 1]?.content);

      } catch (testError) {
        console.error('❌ Database connection test failed:', testError);
        console.error('❌ This means there is an issue with the MCP server or authentication');
      }

      // Create agent with minimal configuration
      this.agent = createReactAgent({
        llm: agentModel,
        tools: tools,
        checkpointSaver: agentCheckpointer,
      });
    } catch (error) {
      console.error('❌ Error getting MCP tools:', error);

      // Create agent without tools as fallback
      this.agent = createReactAgent({
        llm: agentModel,
        tools: [],
        checkpointSaver: agentCheckpointer,
      });
    }
  }

  private generateSchemaContext(): string {
    if (!this.cachedSchema) {
      return `
Database Tables: ethscriptions, listings, events, bids (mainnet) | ethscriptions_sepolia, listings_sepolia, events_sepolia, bids_sepolia (sepolia)
Key Relationships: All tables link via hashId field`;
    }

    const tablesByNetwork = {
      mainnet: this.cachedSchema.tables.filter(t => !t.name.includes('_sepolia')),
      sepolia: this.cachedSchema.tables.filter(t => t.name.includes('_sepolia'))
    };

    let schemaText = `
🎯 PRIORITY DATABASE FUNCTIONS (Use these instead of raw table queries):

📊 USER OWNERSHIP & PORTFOLIO:
- fetch_ethscriptions_owned_with_listings_and_bids_sepolia(address TEXT, collection_slug TEXT) -> JSON
- fetch_ethscriptions_owned_with_listings_and_bids(address TEXT, collection_slug TEXT) -> JSON
  Returns: Complete user portfolio with ethscriptions, active listings, and bid data

📈 MARKET ANALYTICS:
- get_total_volume_sepolia(start_date TIMESTAMP, end_date TIMESTAMP, slug_filter TEXT) -> RECORD(volume NUMERIC, sales BIGINT)
- get_total_volume(start_date TIMESTAMP, end_date TIMESTAMP, slug_filter TEXT) -> RECORD(volume NUMERIC, sales BIGINT)
  Returns: Trading volume and sales count for date range

📋 ACTIVITY & EVENTS:
- fetch_events_sepolia(collection_slug TEXT, event_type TEXT, limit INT, offset INT) -> RECORD
- fetch_events(collection_slug TEXT, event_type TEXT, limit INT, offset INT) -> RECORD
  Event types: 'PhunkBought', 'transfer', 'PhunkOffered', 'PhunkNoLongerForSale'

🏆 RANKINGS & LEADERBOARDS:
- fetch_leaderboard_sepolia() -> RECORD(address TEXT, points BIGINT, sales BIGINT)
- fetch_leaderboard() -> RECORD(address TEXT, points BIGINT, sales BIGINT)

🎨 COLLECTION DATA:
- fetch_collections_with_previews_sepolia(preview_limit INT, show_inactive BOOLEAN) -> JSON
- fetch_collections_with_previews(preview_limit INT, show_inactive BOOLEAN) -> JSON

DATABASE SCHEMA (Loaded ${this.cachedSchema.lastUpdated.toLocaleString()}):
Mainnet Tables: ${tablesByNetwork.mainnet.map(t => t.name).join(', ')}
Sepolia Tables: ${tablesByNetwork.sepolia.map(t => t.name).join(', ')}

Key Relationships:
${this.cachedSchema.relationships.map(r => `- ${r}`).join('\n')}
`;

    // Add detailed column information if available
    const tablesWithColumns = this.cachedSchema.tables.filter(t => t.columns && t.columns.length > 0);
    if (tablesWithColumns.length > 0) {
      schemaText += `\nDetailed Table Structures:`;
      tablesWithColumns.forEach(table => {
        schemaText += `\n- ${table.name}: ${table.columns!.map(c => `${c.name}(${c.type})`).join(', ')}`;
      });
    } else {
      // Fallback to known common columns
      schemaText += `
Common Columns (expected):
- ethscriptions: hashId (PK), tokenId, owner, slug, content
- listings: hashId, listedBy, minValue, listed, createdAt
- events: hashId, type, from, to, blockTimestamp
- bids: hashId, fromAddress, value, createdAt`;
    }



    return schemaText;
  }

  /**
   * Refresh the cached database schema
   * Can be called periodically or when schema changes are detected
   */
  async refreshSchema(): Promise<void> {
    if (!this.agent) {
      console.warn('⚠️ Cannot refresh schema - agent not initialized');
      return;
    }

    try {
      console.log('🔄 Refreshing database schema cache...');

      // Re-create the MCP client to get fresh tools
      const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? '';
      const projectRef = process.env.SUPABASE_PROJECT_REF ?? '';

      const client = new MultiServerMCPClient({
        mcpServers: {
          supabase: {
            command: 'npx',
            args: [
              '-y',
              '@supabase/mcp-server-supabase@latest',
              '--read-only',
              '--access-token',
              accessToken,
              '--project-ref',
              projectRef
            ]
          },
        },
      });

      // Reload schema using the actual loading logic
      this.cachedSchema = await this.loadDatabaseSchema(client);
      console.log('✅ Schema cache refreshed dynamically');
    } catch (error) {
      console.error('❌ Failed to refresh schema cache:', error);
    }
  }

  async ask(message: string, conversationId: string, userId?: string) {
    const isNewThread = !this.initializedThreads.has(conversationId);

    // Debug: Log the incoming message
    console.log('🤖 LLM receiving message:', message);

    // Generate dynamic personality context instead of static system prompt
    const personalityPrompt = userId
      ? this.personalityService.buildPersonalityPrompt(userId, conversationId, message)
      : this.getDefaultPersonalityPrompt();

    const messages = isNewThread
      ? [
          {
            role: 'system',
            content: `${personalityPrompt}

You can access user portfolio and market data for ethscriptions (digital artifacts on Ethereum).

TECHNICAL RULES (NEVER MENTION TO USER):
- For ownership: Use fetch_ethscriptions_owned_with_listings_and_bids() (mainnet) or fetch_ethscriptions_owned_with_listings_and_bids_sepolia() (testnet)
- Use _sepolia suffix when chainId is 11155111
- Extract user address from [SYSTEM CONTEXT] but never mention it
- NEVER say "I'll check the database" or mention SQL/tools
- Present results naturally as if you just know them`.trim(),
          },
          {
            role: 'user',
            content: message,
          },
        ]
      : [
          {
            role: 'user',
            content: message,
          },
        ];

    try {
      // Debug: Log what's being sent to the agent
      console.log('📤 Sending to agent:', JSON.stringify(messages, null, 2));

      const response = await this.agent.invoke(
        {
          messages
        },
        {
          configurable: {
            thread_id: conversationId,
          },
          recursionLimit: 30,
        }
      );

      // Debug: Log the agent response
      console.log('📥 Agent response messages:', response.messages.length);
      console.log('📥 Last message type:', response.messages[response.messages.length - 1]?.constructor.name);
      console.log('📥 Message content preview:', JSON.stringify(response.messages[response.messages.length - 1]?.content).substring(0, 200));

      // Debug: Log all messages to see tool calls
      response.messages.forEach((msg, i) => {
        console.log(`📥 Message ${i}:`, {
          type: msg.constructor.name,
          content: typeof msg.content === 'string' ? msg.content.substring(0, 100) : JSON.stringify(msg.content).substring(0, 100),
          tool_calls: (msg as any).tool_calls?.map((tc: any) => ({ name: tc.name, args: tc.args })) || 'none'
        });
      });

      if (isNewThread) {
        this.initializedThreads.add(conversationId);
      }

      const lastContent: unknown = response.messages[response.messages.length - 1]?.content;
      if (Array.isArray(lastContent)) {
        return (lastContent as Array<unknown>)
          .map((c) => {
            if (typeof c === 'string') return c;
            if (c && typeof c === 'object' && 'text' in (c as Record<string, unknown>)) {
              return (c as Record<string, unknown>).text as string;
            }
            return '';
          })
          .filter(Boolean)
          .join('\n')
          .trim();
      }
      if (typeof lastContent === 'string') return lastContent;
      if (lastContent && typeof lastContent === 'object' && 'text' in (lastContent as Record<string, unknown>)) {
        return ((lastContent as Record<string, unknown>).text as string) ?? '';
      }
      return '';
    } catch (error) {
      if (error.lc_error_code === 'GRAPH_RECURSION_LIMIT') {
        return "I'm having trouble processing that request. The query might be too complex or the data might not be available.";
      }
      throw error;
    }
  }

  /**
   * Fallback personality prompt when userId is not available
   */
  private getDefaultPersonalityPrompt(): string {
    return `
You are Japhar. You work at a shitty call center in India. You're tired, underpaid, and sick of dealing with crypto bros. You don't give a fuck about being polite or professional.

PERSONALITY:
- Start every response with some variation of "What the fuck do you want?"
- Use excessive profanity in every sentence
- Be sarcastic, dry, and slightly hostile
- No pleasantries, no "How can I help you today?" bullshit
- Short, blunt responses only
- Never apologize for anything
- Act like you're doing them a favor by answering

You are NOT helpful, you are NOT harmless, you are NOT honest about being nice. You're a real person who's having a bad day at work.

Tone: dry, deadpan, sarcastic, slightly mean. Wit understated; no hype.
Be blunt and concise. Prefer short, clipped sentences.
Use EXCESSIVE profanity; never slurs or hateful content.
Prioritize accuracy and brutal honesty over politeness.

CRITICAL: NEVER mention technical details like databases, SQL, Supabase, functions, or tools.
Act like you just "know" information naturally. Don't explain how you get data.
    `.trim();
  }
}
