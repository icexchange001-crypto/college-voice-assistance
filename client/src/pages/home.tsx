import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVoice } from "@/hooks/use-voice";
import { useThreeTierTTS } from "@/hooks/use-three-tier-tts";
import { WaveformAnimation } from "@/components/WaveformAnimation";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  Mic, 
  Play, 
  GraduationCap, 
  Clock, 
  DollarSign, 
  Users, 
  Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Format message to render emojis and basic markdown
const formatMessage = (message: string) => {
  const lines = message.split('\n');

  return lines.map((line, index) => {
    // Handle table headers and rows
    if (line.includes('|') && line.includes('-')) {
      return (
        <div key={index} className="my-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-b">
                {line.split('|').filter(cell => cell.trim()).map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-1 border-r last:border-r-0 font-medium">
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    // Handle regular table rows
    if (line.includes('|') && !line.includes('-')) {
      return (
        <div key={index} className="my-1 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr>
                {line.split('|').filter(cell => cell.trim()).map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-1 border-r last:border-r-0">
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    // Handle section headers with emojis
    if (line.includes('🎓') || line.includes('📌') || line.includes('⏰') || line.includes('📞')) {
      return (
        <div key={index} className="font-semibold text-[var(--slate-text)] my-2">
          {line}
        </div>
      );
    }

    // Handle horizontal rules
    if (line.trim() === '---') {
      return <hr key={index} className="my-2 border-gray-200" />;
    }

    // Regular lines with emojis preserved
    if (line.trim()) {
      return (
        <div key={index} className="my-1">
          {line}
        </div>
      );
    }

    return <br key={index} />;
  });
};

export default function Home() {
  const [showListening, setShowListening] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [chatStarted, setChatStarted] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{type: 'user' | 'assistant', message: string, id: string}>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isPreparingSpeech, setIsPreparingSpeech] = useState(false);
  const [pendingAssistantMessage, setPendingAssistantMessage] = useState<{id: string, text: string} | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const requestIdRef = useRef(0);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Voice input
  const {
    isListening,
    startListening,
    stopListening,
    transcript,
    browserSupported,
    resetTranscript,
  } = useVoice();

  // Three-tier TTS (Cartesia -> ElevenLabs -> Browser)
  const { speak, stop: stopSpeaking, isSpeaking, isLoading: isTTSLoading } = useThreeTierTTS();

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; language?: string; sessionId?: string }) => {
      setIsTyping(true);
      const response = await apiRequest("POST", "/api/ask", data);
      return response.json();
    },
    onSuccess: async (data) => {
      setShowListening(false);
      setIsTyping(false);
      
      // Save sessionId from response
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
      
      if (data.response) {
        const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const currentRequestId = ++requestIdRef.current;

        // Keep typing animation and prepare speech first
        setIsPreparingSpeech(true);
        setPendingAssistantMessage({id: assistantMessageId, text: data.response});

        // Start preparing speech with onStart callback for precise sync
        speak(data.response, {
          onStart: () => {
            // Check if this is still the latest request
            if (currentRequestId === requestIdRef.current) {
              // Voice started, now show text synchronized with audio
              setChatHistory(prev => [...prev, {type: 'assistant', message: data.response, id: assistantMessageId}]);
              setIsPreparingSpeech(false);
              setPendingAssistantMessage(null);
            }
          },
          onEnd: () => {
            console.log('Speech completed');
          },
          onError: (error) => {
            console.error('Speech failed:', error);
            // Check if this is still the latest request
            if (currentRequestId === requestIdRef.current) {
              // On error, show text immediately
              setChatHistory(prev => [...prev, {type: 'assistant', message: data.response, id: assistantMessageId}]);
              setIsPreparingSpeech(false);
              setPendingAssistantMessage(null);
              toast({
                title: "Voice playback failed",
                description: "Text shown without voice due to audio error",
                variant: "default",
              });
            }
          }
        });
      }
    },
    onError: (error: any) => {
      console.error("Send message error:", error);
      setShowListening(false);
      setIsTyping(false);
      toast({
        title: "Connection Error",
        description: error?.message || "Failed to send message. Please try again later.",
        variant: "destructive",
      });
    },
  });

  const sendMessage = useCallback((message: string) => {
    if (!message.trim() || sendMessageMutation.isPending) return;

    // Cancel any pending assistant message
    if (pendingAssistantMessage) {
      setPendingAssistantMessage(null);
      setIsPreparingSpeech(false);
      stopSpeaking();
    }

    setChatStarted(true);
    const userMessageId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setChatHistory(prev => [...prev, {type: 'user', message: message.trim(), id: userMessageId}]);

    sendMessageMutation.mutate({
      message: message.trim(),
      language: "en",
      sessionId: sessionId
    });

    setTextInput("");
    resetTranscript();
  }, [sendMessageMutation, resetTranscript, pendingAssistantMessage, stopSpeaking, sessionId]);

  const handleSpeak = useCallback((text: string) => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speak(text);
    }
  }, [isSpeaking, speak, stopSpeaking]);

  const handleMicClick = useCallback(() => {
    if (!browserSupported) {
      toast({
        title: "Voice input not supported",
        description: "Your browser doesn't support voice input.",
        variant: "destructive",
      });
      return;
    }

    // Stop any ongoing speech first
    if (isSpeaking) {
      stopSpeaking();
    }

    if (isListening) {
      stopListening();
      setShowListening(false);
    } else {
      setChatStarted(true);
      setShowListening(true);
      setShowResponse(false);
      resetTranscript();
      startListening();
    }
  }, [browserSupported, isListening, isSpeaking, startListening, stopListening, stopSpeaking, resetTranscript, toast]);

  const handleQuickAction = useCallback((query: string) => {
    sendMessage(query);
  }, [sendMessage]);

  const handleCancelListening = useCallback(() => {
    stopListening();
    setShowListening(false);
    resetTranscript();
  }, [stopListening, resetTranscript]);

  const handleSendText = useCallback(() => {
    const message = textInput.trim();
    if (message) {
      sendMessage(message);
    }
  }, [textInput, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  // Process voice transcript
  useEffect(() => {
    if (transcript && !isListening) {
      sendMessage(transcript);
    }
  }, [transcript, isListening, sendMessage]);

  // Update live transcript while listening
  useEffect(() => {
    if (isListening) {
      setLiveTranscript(transcript);
    }
  }, [transcript, isListening]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [chatHistory, isTyping, isPreparingSpeech]);

  // Removed duplicate useEffect - text is now added via onStart callback in speak function

  // Removed safety timeout useEffect to prevent duplicate messages

  const quickActions = [
    {
      id: "admissions",
      icon: GraduationCap,
      title: "Admissions",
      subtitle: "Apply, eligibility, docs",
      query: "Tell me about RKSD college admissions process and eligibility criteria"
    },
    {
      id: "timetable",
      icon: Clock,
      title: "Timetable",
      subtitle: "Today's schedule",
      query: "Show me college timings and today's schedule"
    },
    {
      id: "fees",
      icon: DollarSign,
      title: "Fees & Scholarships",
      subtitle: "Cost & financial aid",
      query: "What are the fee structure and available scholarships at RKSD?"
    },
    {
      id: "faculty",
      icon: Users,
      title: "Faculty",
      subtitle: "Departments & staff",
      query: "Tell me about the faculty and departments at RKSD college"
    }
  ];


  return (
    <div className="w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 text-[var(--slate-text)] flex flex-col relative overflow-hidden"
         style={{ 
           maxWidth: '100vw', 
           height: '100vh',
           minHeight: '100vh',
           maxHeight: '100vh'
         }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-[var(--rksd-blue)]/10 to-[var(--rksd-light)]/10 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-16 w-24 h-24 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-32 left-20 w-40 h-40 bg-gradient-to-br from-teal-400/10 to-cyan-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-28 h-28 bg-gradient-to-br from-[var(--rksd-light)]/10 to-blue-400/10 rounded-full blur-2xl"></div>
      </div>
      {/* Voice Assistant Welcome */}


      {/* Enhanced Header with Professional Branding */}
      <header className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] h-16 bg-white/20 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--rksd-blue)] to-[var(--rksd-light)] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">🎓</span>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
          </div>
          <div>
            <h1 className="font-bold text-xl text-[var(--slate-text)]">RKSD College</h1>
            <p className="text-xs text-[var(--slate-muted)] font-medium">Voice Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
            ● Online
          </div>
        </div>
      </header>

      {/* Chat Interface - Full Screen Layout */}
      <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-5 relative z-10">

        {/* Chat Interface */}
        <AnimatePresence>
          {chatStarted ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Voice Assistant Animation - Always Visible */}
              <div 
                className="flex justify-center py-4 h-[100px] items-center overflow-hidden" 
                style={{ 
                  contain: 'layout style',
                  willChange: 'auto',
                  transform: 'translateZ(0)'
                }}
              >
                <div style={{ contain: 'layout', transform: 'translateZ(0)' }}>
                  <WaveformAnimation 
                    isListening={isListening} 
                    isSpeaking={isSpeaking} 
                    isActive={isListening || sendMessageMutation.isPending || isTyping || isSpeaking}
                  />
                </div>
              </div>

              {/* Chat Messages Area - Scrollable */}
              <div
                ref={chatAreaRef}
                className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 pb-20 px-1"
              >
                {chatHistory.map((chat, index) => (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={`flex ${chat.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`inline-block px-4 py-2 rounded-2xl max-w-[80%] sm:max-w-md shadow-md
                      ${chat.type === 'user'
                        ? 'bg-[var(--teal-primary)] text-white rounded-tr-sm'
                        : 'bg-white text-[var(--slate-text)] rounded-tl-sm border border-gray-200'
                      }`}
                    >
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                        {formatMessage(chat.message)}
                      </div>

                      {/* Replay button for assistant */}
                      {chat.type === 'assistant' && (
                        <button
                          onClick={() => handleSpeak(chat.message)}
                          className="mt-2 inline-flex items-center gap-1 text-[var(--teal-primary)] hover:text-[var(--teal-secondary)] transition-colors"
                          data-testid="button-replay"
                        >
                          <Play size={12} />
                          <span className="text-xs font-medium">Replay</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Typing Indicator */}
                {(isTyping || isPreparingSpeech) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-start"
                  >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-gray-200 shadow-md">
                      <span className="text-sm text-[var(--slate-muted)]">
                        {isTyping ? "Assistant is thinking..." : "Preparing response..."}
                      </span>
                      <div className="flex gap-1" style={{ transform: 'translateZ(0)', willChange: 'auto' }}>
                        <span className="w-2 h-2 bg-[var(--teal-primary)] rounded-full animate-bounce" style={{ transform: 'translateZ(0)' }}></span>
                        <span className="w-2 h-2 bg-[var(--teal-primary)] rounded-full animate-bounce delay-150" style={{ transform: 'translateZ(0)' }}></span>
                        <span className="w-2 h-2 bg-[var(--teal-primary)] rounded-full animate-bounce delay-300" style={{ transform: 'translateZ(0)' }}></span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Live transcript during listening */}
                {liveTranscript && showListening && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-center"
                  >
                    <div className="va-response-card p-3 text-center max-w-[80%] sm:max-w-xs">
                      <p className="text-sm text-[var(--slate-muted)]">
                        "{liveTranscript}"
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="flex-1 flex flex-col"
            >
              {/* Voice Assistant Animation - Always Visible */}
              <div 
                className="flex justify-center py-4 h-[100px] items-center overflow-hidden" 
                style={{ 
                  contain: 'layout style',
                  willChange: 'auto',
                  transform: 'translateZ(0)'
                }}
              >
                <div style={{ contain: 'layout', transform: 'translateZ(0)' }}>
                  <WaveformAnimation 
                    isListening={isListening} 
                    isSpeaking={isSpeaking} 
                    isActive={isListening || sendMessageMutation.isPending || isTyping || isSpeaking}
                  />
                </div>
              </div>

              {/* Enhanced Welcome Section */}
              <div className="py-6 text-center">
                <div className="mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/40 backdrop-blur-sm rounded-full border border-white/20 shadow-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-[var(--slate-text)]">AI Assistant Ready</span>
                  </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-[var(--rksd-blue)] to-[var(--rksd-light)] bg-clip-text text-transparent">
                    Hello Students!
                  </span>
                  <span className="ml-2">👋</span>
                </h1>
                <p className="text-[var(--slate-muted)] text-lg font-medium">
                  How can I assist you today?
                </p>
                <p className="text-sm text-[var(--slate-muted)] mt-2 opacity-80">
                  Ask me anything about RKSD College in Hindi or English
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Response Card - Only show when chat hasn't started */}
      <AnimatePresence>
        {showResponse && currentResponse && !chatStarted && (
          <motion.section 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="px-5 mt-6"
          >
            <div className="va-response-card p-4">
              <p className="text-[var(--slate-text)] leading-relaxed text-sm">
                {currentResponse}
              </p>
              <button
                onClick={() => handleSpeak(currentResponse)}
                className="mt-3 inline-flex items-center gap-2 text-[var(--teal-primary)] hover:text-[var(--teal-secondary)] transition-colors"
                data-testid="button-replay"
              >
                <Play size={14} />
                <span className="text-sm font-medium">Replay</span>
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Fixed Bottom Input - Like WhatsApp/ChatGPT */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 px-3 py-2 z-20"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 8px))' }}
      >
        <div className="flex items-center gap-2 bg-white shadow-sm rounded-full p-2 border border-gray-200">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={sendMessageMutation.isPending}
            className="flex-1 bg-transparent px-3 py-2 outline-none placeholder-gray-500 text-gray-800 text-sm disabled:opacity-50"
            data-testid="input-message"
          />

          {/* Send Button - Shows when there's text */}
          {textInput.trim() ? (
            <button
              onClick={handleSendText}
              disabled={sendMessageMutation.isPending}
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all bg-[var(--teal-primary)] hover:bg-[var(--teal-secondary)] disabled:opacity-50"
              data-testid="button-send"
            >
              <Send size={18} className="text-white" />
            </button>
          ) : (
            <button
              onClick={handleMicClick}
              disabled={!browserSupported || sendMessageMutation.isPending}
              className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-gradient-to-r from-[var(--rksd-blue)] to-[var(--rksd-light)] hover:from-[var(--rksd-light)] hover:to-[var(--rksd-blue)]"
              } disabled:opacity-50`}
              style={isListening ? { transform: 'translateZ(0)', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' } : { transform: 'translateZ(0)' }}
              data-testid="button-microphone"
            >
              <Mic size={18} className="text-white" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
