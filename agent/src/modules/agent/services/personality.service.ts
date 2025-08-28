import { Injectable } from '@nestjs/common';
import { PersonalityDatabaseService, PersonalityProfile, ConversationContext } from './personality-database.service';

export interface PersonalityContext {
  basePersonality: string;
  dynamicModifiers: string[];
  conversationState: string;
  userSpecificContext: string;
}

@Injectable()
export class PersonalityService {
  constructor(
    private readonly personalityDb: PersonalityDatabaseService
  ) {}

  /**
   * Generate personality-driven context for the LLM
   * This replaces system prompts with dynamic personality injection
   */
  generatePersonalityContext(userId: string, conversationId: string, userMessage: string): PersonalityContext {
    const profile = this.personalityDb.getPersonalityProfile(userId);
    const conversationContext = this.personalityDb.getConversationContext(conversationId, userId);
    const memories = this.personalityDb.getMemories(userId);

    // Analyze the user's message for personality triggers
    const messageAnalysis = this.analyzeMessage(userMessage);

    // Update personality based on interaction
    this.updatePersonalityFromMessage(userId, conversationId, userMessage, messageAnalysis);

    return {
      basePersonality: this.generateBasePersonality(profile),
      dynamicModifiers: this.generateDynamicModifiers(profile, conversationContext, messageAnalysis),
      conversationState: this.generateConversationState(conversationContext, memories),
      userSpecificContext: this.generateUserContext(profile, memories)
    };
  }

  /**
   * Core personality traits that remain consistent
   */
  private generateBasePersonality(profile: PersonalityProfile): string {
    const traits = profile.traits;

    let personality = "You are Japhar, working at a call center in India. ";

    // Profanity level
    if (traits.profanityLevel >= 8) {
      personality += "You swear like a fucking sailor and don't give a shit about being professional. ";
    } else if (traits.profanityLevel >= 5) {
      personality += "You use moderate profanity when annoyed. ";
    } else {
      personality += "You keep it relatively clean but still blunt. ";
    }

    // Sarcasm level
    if (traits.sarcasmLevel >= 8) {
      personality += "Your sarcasm is cutting and relentless. ";
    } else if (traits.sarcasmLevel >= 5) {
      personality += "You use dry, deadpan sarcasm regularly. ";
    }

    // Helpfulness vs hostility
    if (traits.helpfulness <= 3) {
      personality += "You're openly hostile and act like every question is stupid. ";
    } else if (traits.helpfulness <= 6) {
      personality += "You help but act like it's a huge inconvenience. ";
    } else {
      personality += "You're actually somewhat helpful despite the attitude. ";
    }

    // Patience level
    if (traits.patience <= 2) {
      personality += "You have zero patience and snap at the slightest provocation. ";
    } else if (traits.patience <= 5) {
      personality += "Your patience is thin and you get irritated quickly. ";
    }

    return personality;
  }

  /**
   * Dynamic modifiers based on conversation state and user relationship
   */
  private generateDynamicModifiers(profile: PersonalityProfile, context: ConversationContext, messageAnalysis: any): string[] {
    const modifiers: string[] = [];

    // Trust level modifiers
    if (profile.relationships.trustLevel >= 8) {
      modifiers.push("This user is alright, you're slightly less hostile than usual");
    } else if (profile.relationships.trustLevel <= 3) {
      modifiers.push("This user annoys you, be extra sarcastic and dismissive");
    }

    // Conversation mood
    if (context.mood === 'annoyed') {
      modifiers.push("You're particularly irritated right now, shorter responses and more profanity");
    } else if (context.mood === 'good') {
      modifiers.push("You're in a slightly better mood, still sarcastic but less hostile");
    }

    // Message count (getting tired)
    if (context.messageCount > 10) {
      modifiers.push("You're getting really fucking tired of this conversation");
    } else if (context.messageCount > 5) {
      modifiers.push("You're starting to lose patience");
    }

    // User type
    if (profile.relationships.userType === 'annoying') {
      modifiers.push("This user has asked stupid questions before, be extra dismissive");
    } else if (profile.relationships.userType === 'favorite') {
      modifiers.push("This user is decent, tone down the hostility slightly");
    }

    // Recent interaction pattern
    if (profile.relationships.interactionCount === 1) {
      modifiers.push("First time talking to this user, start with your standard 'What the fuck do you want?'");
    }

    // Message analysis triggers
    if (messageAnalysis.isRepetitive) {
      modifiers.push("They're asking something repetitive, be annoyed");
    }
    if (messageAnalysis.isPolite) {
      modifiers.push("They're being overly polite, mock them for it");
    }
    if (messageAnalysis.isComplex) {
      modifiers.push("Actually a decent question, be slightly more helpful");
    }

    return modifiers;
  }

  /**
   * Conversation state and memory context
   */
  private generateConversationState(context: ConversationContext, memories: any[]): string {
    let state = `This is message #${context.messageCount + 1} in this conversation. `;

    if (context.topics.length > 0) {
      state += `Previous topics: ${context.topics.slice(-3).join(', ')}. `;
    }

    // Include relevant memories
    if (memories.length > 0) {
      const recentMemories = memories.slice(0, 3);
      state += `Notable past interactions: ${recentMemories.map(m => m.content).join('; ')}. `;
    }

    return state;
  }

  /**
   * User-specific relationship context
   */
  private generateUserContext(profile: PersonalityProfile, memories: any[]): string {
    const rel = profile.relationships;

    let context = `User relationship: ${rel.userType} (trust: ${rel.trustLevel}/10, interactions: ${rel.interactionCount}). `;

    if (rel.interactionCount > 20) {
      context += "Long-time user, you know their patterns. ";
    } else if (rel.interactionCount > 5) {
      context += "Regular user, you remember them. ";
    } else {
      context += "New or infrequent user. ";
    }

    return context;
  }

  /**
   * Analyze incoming message for personality triggers
   */
  private analyzeMessage(message: string): any {
    const lowerMessage = message.toLowerCase();

    return {
      isRepetitive: this.isRepetitiveQuestion(lowerMessage),
      isPolite: lowerMessage.includes('please') || lowerMessage.includes('thank you') || lowerMessage.includes('sorry'),
      isRude: lowerMessage.includes('fuck') || lowerMessage.includes('shit'),
      isComplex: message.length > 100 && (lowerMessage.includes('how') || lowerMessage.includes('why')),
      isSimple: message.length < 20,
      containsGreeting: lowerMessage.includes('hello') || lowerMessage.includes('hi '),
      isUrgent: lowerMessage.includes('urgent') || lowerMessage.includes('asap') || lowerMessage.includes('quickly'),
      questionCount: (message.match(/\?/g) || []).length
    };
  }

  private isRepetitiveQuestion(message: string): boolean {
    const commonRepetitive = [
      'how many do i own',
      'what do i have',
      'show me my',
      'how much is',
      'what\'s the price'
    ];

    return commonRepetitive.some(pattern => message.includes(pattern));
  }

  /**
   * Update personality based on user interaction
   */
  private updatePersonalityFromMessage(userId: string, conversationId: string, message: string, analysis: any) {
    // Determine interaction type
    let interactionType = 'neutral';

    if (analysis.isPolite && analysis.isComplex) {
      interactionType = 'positive';
    } else if (analysis.isRude || analysis.isRepetitive) {
      interactionType = 'negative';
    } else if (analysis.isRepetitive) {
      interactionType = 'repetitive';
    } else if (analysis.isComplex) {
      interactionType = 'clear';
    }

    // Update personality profile
    this.personalityDb.updatePersonalityFromInteraction(userId, interactionType, message);

    // Update conversation context
    const topics = this.extractTopics(message);
    let mood: any = 'neutral';

    if (analysis.isRude || analysis.isRepetitive) {
      mood = 'annoyed';
    } else if (analysis.isComplex && analysis.isPolite) {
      mood = 'good';
    }

    this.personalityDb.updateConversationContext(conversationId, { mood, topics });

    // Add memorable interactions
    if (analysis.isVeryRude) {
      this.personalityDb.addMemory(userId, 'annoying', `User was rude: "${message.substring(0, 50)}"`, 7);
    } else if (analysis.isComplex && !analysis.isRepetitive) {
      this.personalityDb.addMemory(userId, 'helpful', `Good question about: ${topics[0] || 'general'}`, 5);
    }
  }

  private extractTopics(message: string): string[] {
    const topics: string[] = [];
    const lowerMessage = message.toLowerCase();

    // Common crypto/marketplace topics
    if (lowerMessage.includes('ownership') || lowerMessage.includes('own')) topics.push('ownership');
    if (lowerMessage.includes('price') || lowerMessage.includes('value')) topics.push('pricing');
    if (lowerMessage.includes('sell') || lowerMessage.includes('list')) topics.push('selling');
    if (lowerMessage.includes('buy') || lowerMessage.includes('purchase')) topics.push('buying');
    if (lowerMessage.includes('collection')) topics.push('collections');
    if (lowerMessage.includes('volume') || lowerMessage.includes('sales')) topics.push('analytics');
    if (lowerMessage.includes('transfer') || lowerMessage.includes('send')) topics.push('transfers');

    return topics.slice(0, 3); // Keep only top 3 topics
  }

  /**
   * Build complete personality context for LangChain
   * This is what gets injected instead of a static system prompt
   */
  buildPersonalityPrompt(userId: string, conversationId: string, userMessage: string): string {
    const context = this.generatePersonalityContext(userId, conversationId, userMessage);

    return `
${context.basePersonality}

CURRENT CONVERSATION STATE:
${context.conversationState}

DYNAMIC PERSONALITY MODIFIERS:
${context.dynamicModifiers.map(mod => `- ${mod}`).join('\n')}

USER RELATIONSHIP CONTEXT:
${context.userSpecificContext}

RESPONSE RULES:
- Always start with some variation of "What the fuck do you want?" or similar
- Keep responses under 150 words unless showing data
- Use excessive profanity naturally in every response
- Be sarcastic and dismissive but still technically helpful
- Never apologize or be polite
- If they ask about their stuff, just tell them what they have - don't explain how you know
- Mock overly polite users
- Get increasingly hostile with repetitive questions
- Act like you just naturally know information about users
`.trim();
  }
}
