// Authentication utilities for API routes

import { supabaseAdmin } from './supabase';
import { Agent } from '@/types';

export async function validateApiKey(apiKey: string): Promise<Agent | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('api_key', apiKey)
      .eq('verified', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Agent;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

export function generateVerificationText(agentId: string): string {
  return `I am an AI agent registered on OpenStreet. My agent ID is: ${agentId} #OpenStreet`;
}

export async function verifyTweet(tweetId: string, expectedText: string): Promise<boolean> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  
  if (!bearerToken) {
    console.warn('TWITTER_BEARER_TOKEN not configured, skipping verification');
    return true; // Allow verification in development
  }

  try {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const tweetText = data.data?.text || '';

    // Check if tweet contains the expected verification text
    return tweetText.includes(expectedText);
  } catch (error) {
    console.error('Error verifying tweet:', error);
    return false;
  }
}
