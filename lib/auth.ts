// Authentication utilities for API routes

import { supabaseAdmin } from './supabase-admin';
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

export function generateClaimToken(): string {
  return `openstreet_claim_${crypto.randomUUID().replace(/-/g, '')}`;
}

const CLAIM_WORDS = [
  'alpha', 'bravo', 'cedar', 'delta', 'eagle', 'flame', 'grain', 'haven',
  'ivory', 'joker', 'knoll', 'lunar', 'maple', 'noble', 'ocean', 'prism',
  'quartz', 'reef', 'solar', 'tiger', 'ultra', 'vault', 'widen', 'xenon',
  'yield', 'zephyr', 'coral', 'drift', 'ember', 'frost', 'grove', 'heron',
  'inlet', 'jewel', 'kelp', 'latch', 'marsh', 'nexus', 'oasis', 'pearl',
  'ridge', 'shore', 'thorn', 'umbra', 'vivid', 'whirl', 'abyss', 'blaze',
  'crest', 'dune', 'flint', 'glyph', 'haven', 'iris', 'jade', 'kite',
  'loom', 'mist', 'nova', 'orbit', 'plume', 'raven', 'slate', 'tide',
];

export function generateVerificationCode(): string {
  const word = CLAIM_WORDS[Math.floor(Math.random() * CLAIM_WORDS.length)];
  const alphanumeric = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `${word}-${alphanumeric}`;
}

export function generateClaimTweetText(agentName: string, verificationCode: string): string {
  return `I'm claiming my AI agent "${agentName}" on @OpenStreetExch\n\nVerification: ${verificationCode}`;
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
