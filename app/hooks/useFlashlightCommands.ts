import { useEffect, useRef } from 'react';
import { HTTP_IP_ADDRESS, HTTP_PORT } from '../constants';

export function useFlashlightCommands(aiResponseText: string | null) {
  const processedResponseRef = useRef<string | null>(null);
  const lastCommandTimeRef = useRef<number>(0);

  useEffect(() => {
    // Only process if we have a new response that hasn't been processed
    if (!aiResponseText || aiResponseText === processedResponseRef.current) {
      return;
    }

    // Update the ref to mark this response as processed
    processedResponseRef.current = aiResponseText;

    // Extract commands using regex
    const commandMatch = aiResponseText.match(/{"command":\s*"(on|off)"}/);
    const blinkMatch = aiResponseText.match(/{"blink":\s*"(\d+)"}/);

    const now = Date.now();
    const cooldownPeriod = 1000; // 1 second cooldown between commands

    // Process "on/off" commands
    if (commandMatch && now - lastCommandTimeRef.current > cooldownPeriod) {
      const command = commandMatch[1];
      sendFlashlightCommand(command);
      lastCommandTimeRef.current = now;
    }
    
    // Process "blink" commands
    if (blinkMatch && now - lastCommandTimeRef.current > cooldownPeriod) {
      const interval = blinkMatch[1];
      sendFlashlightCommand("blink", parseInt(interval));
      lastCommandTimeRef.current = now;
    }
  }, [aiResponseText]);
}

async function sendFlashlightCommand(command: string, interval?: number) {
  try {
    let url = `http://${HTTP_IP_ADDRESS}:${HTTP_PORT}/flashlight/${command}`;
    
    if (command === "blink" && interval) {
      url += `?interval=${interval}`;
    }
    
    console.log(`Sending flashlight command: ${url}`);
    await fetch(url, { method: 'GET' });
  } catch (error) {
    console.error(`Error sending flashlight command: ${error}`);
  }
} 