import { useFlashlightCommands } from './hooks/useFlashlightCommands';

export default function Home() {
  const [aiResponseText, setAIResponseText] = useState<string | null>(null);
  
  // Use our custom hook to handle flashlight commands
  useFlashlightCommands(aiResponseText);
  
  // When you receive AI responses, update this state
  const handleAIResponse = (response: string) => {
    setAIResponseText(response);
    // Your existing response handling code
  };
} 