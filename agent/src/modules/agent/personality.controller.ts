import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PersonalityService } from './services/personality.service';
import { PersonalityDatabaseService } from './services/personality-database.service';

@Controller('personality')
export class PersonalityController {
  constructor(
    private readonly personalityService: PersonalityService,
    private readonly personalityDb: PersonalityDatabaseService,
  ) {}

  /**
   * Get personality profile for a user
   */
  @Get('profile/:userId')
  async getProfile(@Param('userId') userId: string) {
    const profile = this.personalityDb.getPersonalityProfile(userId);
    return {
      success: true,
      data: profile,
    };
  }

  /**
   * Generate personality context for testing
   */
  @Post('context/:userId')
  async generateContext(
    @Param('userId') userId: string,
    @Body() body: { conversationId: string; message: string }
  ) {
    const context = this.personalityService.generatePersonalityContext(
      userId,
      body.conversationId,
      body.message
    );

    const fullPrompt = this.personalityService.buildPersonalityPrompt(
      userId,
      body.conversationId,
      body.message
    );

    return {
      success: true,
      data: {
        context,
        fullPrompt,
        message: body.message,
      },
    };
  }

  /**
   * Test how the personality responds to ownership questions
   */
  @Post('test-response/:userId')
  async testResponse(
    @Param('userId') userId: string,
    @Body() body: { message: string; conversationId?: string }
  ) {
    const conversationId = body.conversationId || 'test-conversation';

    const fullPrompt = this.personalityService.buildPersonalityPrompt(
      userId,
      conversationId,
      body.message
    );

    return {
      success: true,
      data: {
        originalMessage: body.message,
        generatedPrompt: fullPrompt,
        note: "This shows what prompt is sent to the LLM - notice it includes technical details that should NEVER appear in responses"
      },
    };
  }

  /**
   * Health check for personality system
   */
  @Get('health')
  async healthCheck() {
    try {
      // Test database connectivity
      const testProfile = this.personalityDb.getPersonalityProfile('health-check-test');

      // Test personality generation
      const testContext = this.personalityService.generatePersonalityContext(
        'health-check-test',
        'health-check-conversation',
        'Hello'
      );

      return {
        success: true,
        message: 'Personality system is operational',
        data: {
          databaseConnected: !!testProfile,
          personalityServiceActive: !!testContext,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Personality system error',
        error: error.message,
      };
    }
  }
}
