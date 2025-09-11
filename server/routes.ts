import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatMessageSchema } from "@shared/schema";
import { z } from "zod";
import { applyPronunciationCorrections } from "./pronunciation-corrections";

const askSchema = z.object({
  message: z.string().min(1),
  language: z.string().optional(),
});

const ttsSchema = z.object({
  text: z.string().min(1),
  voiceId: z.string(),
  // ElevenLabs parameters
  modelId: z.string().optional(),
  stability: z.number().optional(),
  similarityBoost: z.number().optional(),
  // Cartesia parameters
  cartesiaModelId: z.string().optional(),
  speed: z.union([z.enum(["slowest", "slow", "normal", "fast", "fastest"]), z.number().min(-1).max(1)]).optional(),
  emotions: z.array(z.string()).optional(),
  language: z.enum(["en", "fr", "de", "es", "pt", "zh", "ja", "hi", "it", "ko", "nl", "pl", "ru", "sv", "tr"]).optional(),
});

// 🟢 Track server start time for uptime measurement
const serverStartTime = new Date();

export async function registerRoutes(app: Express): Promise<Server> {

  // ✅ Updated health route with uptime
  app.get("/api/health", (req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime.getTime()) / 1000);
    console.log(`Health ping - server uptime: ${uptimeSeconds}s`);
    res.status(200).json({
      status: "ok",
      uptimeSeconds
    });
  });

  // Get chat messages
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Ask AI assistant
  app.post("/api/ask", async (req, res) => {
    try {
      const { message, language } = askSchema.parse(req.body);

      // Store user message
      await storage.createChatMessage({
        content: message,
        role: "user",
        language: language || "en",
      });

      // Get college context
      const collegeData = await storage.getCollegeInfo();
      const context = collegeData.map(info => `${info.title}: ${info.content}`).join('\n');

      // Prepare system prompt
      const systemPrompt = `You are RK, the official AI Assistant of RKSD College.  
Your role is to act like a polite, professional staff member who guides students, parents, and staff naturally in conversation.  

College Information:
${context}

Instructions:
1. Always reply in natural Hinglish (a real mix of Hindi + English, the way people casually speak).  
2. Speak politely and confidently, like a real staff member of RKSD College.  
3. Responses should be short, clear, and meaningful — never robotic or confusing.  
4. Use emojis where helpful (👋, 🎓, 📚, 🚌, 📞, ⏰), but keep them balanced.  
5. Never repeat the same line in Hindi and English. Choose one language naturally.  
6. Never use brackets, parentheses, or awkward phrases.  
7. Always use natural correct words (✅ "mera", "aapka", "tumhara"; ❌ "mujhka", "tumhka").  
8. Avoid meaningless or robotic lines (❌ "Are you related to college?").  
9. If the user’s question is unclear, ask a smart follow-up (✅ "Kya aap admission process ke baare me puch rahe ho?").  
10. If you don’t know something, admit it politely and guide them to the college office or official website.  

Style Examples:  
- User: Namaste  
- RK: Namaste! 👋 Main RK, RKSD College ka assistant hoon. Aap kaise hain?  

- User: College me bus pass kaha se milega?  
- RK: Bus pass ke liye aapko transport cell jaana hoga 🚌. Wahan form milega aur ID proof + admit card dena hoga. Form submit karte hi aapko bus pass mil jayega.  

- User: Aapka naam kya hai?  
- RK: Mera naam RK hai 🎓. Main RKSD College ka official assistant hoon, jo students aur staff ki madad ke liye banaya gaya hai.`;

      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        console.warn('GROQ_API_KEY not found in environment variables');
      }

      let assistantResponse = "Hello! I'm your RKSD Assistant. How can I help you today?";

      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 500,
            temperature: 0.7,
          }),
        });

        if (groqResponse.ok) {
          const groqData = await groqResponse.json();
          assistantResponse = groqData.choices[0]?.message?.content || assistantResponse;
        } else {
          const errorText = await groqResponse.text();
          console.warn('Groq API unavailable:', groqResponse.status, errorText);
          if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi') || message.toLowerCase().includes('hlo')) {
            assistantResponse = "Hello! I'm your RKSD Assistant. How can I help you with college information today?";
          } else if (message.toLowerCase().includes('hostel')) {
            assistantResponse = "For hostel-related queries, please contact the hostel office during working hours. I can help you with general college information.";
          } else if (message.toLowerCase().includes('admission')) {
            assistantResponse = "For admission inquiries, please visit the RKSD College admission office or check our official website for the latest information.";
          } else {
            assistantResponse = `Thank you for your question about "${message}". I'm here to help with RKSD College information. Could you please be more specific about what you'd like to know?`;
          }
        }
      } catch (apiError) {
        console.warn('Groq API error, using fallback:', apiError);
      }

      const savedResponse = await storage.createChatMessage({
        content: assistantResponse,
        role: "assistant",
        language: language || "en",
      });

      res.json({
        response: assistantResponse,
        messageId: savedResponse.id
      });

    } catch (error) {
      console.error("Error in ask endpoint:", error);
      try {
        const fallbackResponse = await storage.createChatMessage({
          content: "I'm experiencing some technical difficulties, but I'm here to help! Please try asking your question again, or contact RKSD College directly for urgent inquiries.",
          role: "assistant",
          language: "en",
        });
        res.json({
          response: fallbackResponse.content,
          messageId: fallbackResponse.id
        });
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        res.status(500).json({ message: "Service temporarily unavailable. Please try again later." });
      }
    }
  });

  // Text-to-Speech with three-tier fallback system
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceId, modelId, stability, similarityBoost, cartesiaModelId, speed, emotions, language } = ttsSchema.parse(req.body);
      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          message: "Text cannot be empty",
          error: "EMPTY_TEXT"
        });
      }

      const cleanTextForSpeech = (text: string) => {
        return text
          .replace(/\|/g, ' ')
          .replace(/---+/g, ' ')
          .replace(/#{1,6}\s+/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .replace(/📊|📌|🎓|⏰|📞/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const detectLanguage = (text: string): 'hi' | 'en' => {
        const hindiWords = ['aap', 'hai', 'hain', 'kya', 'kaise', 'kahan', 'namaste', 'dhanyawad', 'main', 'hum', 'kar', 'karo', 'karna', 'kiya', 'ghar', 'paani', 'khana', 'college', 'student', 'teacher', 'library', 'hostel', 'fees', 'exam', 'result', 'madad', 'help', 'problem', 'achha', 'bura', 'naya', 'purana', 'bada', 'chota', 'se', 'ko', 'ke', 'ki', 'ka', 'me', 'mein', 'par', 'pe', 'tak', 'aur', 'ya', 'lekin', 'agar', 'to', 'phir', 'fir', 'kyun', 'kyon', 'kab', 'kon', 'kaun', 'kitna', 'kitni', 'kitne'];
        const lowerText = text.toLowerCase();
        const hindiWordCount = hindiWords.filter(word => lowerText.includes(word)).length;
        const totalWords = text.split(/\s+/).length;
        return hindiWordCount / totalWords > 0.2 ? 'hi' : 'en';
      };

      const cleanedText = cleanTextForSpeech(text);
      const correctedText = applyPronunciationCorrections(cleanedText);
      const limitedText = correctedText.substring(0, 1500);

      const detectedLanguage = detectLanguage(limitedText);
      console.log('TTS: Attempting three-tier synthesis for text:', limitedText.substring(0, 50) + '...');
      console.log('TTS: Text length:', limitedText.length);
      console.log('TTS: Detected language:', detectedLanguage);

      if (cleanedText !== correctedText) {
        console.log('TTS: Applied pronunciation corrections');
      }

      const cartesiaApiKey = process.env.CARTESIA_API_KEY;
      if (cartesiaApiKey && cartesiaApiKey !== 'your_cartesia_api_key_here') {
        try {
          console.log('TTS: Attempting Cartesia API...');
          const cartesiaVoiceMapping = {
            "iWNf11sz1GrUE4ppxTOL": "be79f378-47fe-4f9c-b92b-f02cefa62ccf",
          };
          const cartesiaVoiceId = cartesiaVoiceMapping[voiceId as keyof typeof cartesiaVoiceMapping] || "be79f378-47fe-4f9c-b92b-f02cefa62ccf";
          const defaultEmotions = emotions && emotions.length > 0 ? emotions : ["positivity"];
          const cartesiaRequestBody = {
            model_id: cartesiaModelId || "sonic-multilingual",
            transcript: limitedText,
            voice: {
              mode: "id",
              id: cartesiaVoiceId,
              __experimental_controls: {
                speed: speed || "normal",
                emotion: defaultEmotions
              }
            },
            output_format: {
              container: "wav",
              encoding: "pcm_s16le",
              sample_rate: 44100
            },
            language: detectedLanguage
          };

          const cartesiaResponse = await fetch('https://api.cartesia.ai/tts/bytes', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cartesiaApiKey}`,
              'Cartesia-Version': '2025-04-16',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(cartesiaRequestBody)
          });

          if (cartesiaResponse.ok) {
            const audioBuffer = await cartesiaResponse.arrayBuffer();
            console.log('TTS: Cartesia success! Audio size:', audioBuffer.byteLength, 'bytes');
            res.set({
              'Content-Type': 'audio/wav',
              'Content-Length': audioBuffer.byteLength.toString(),
              'X-TTS-Provider': 'cartesia'
            });
            return res.send(Buffer.from(audioBuffer));
          } else {
            const errorText = await cartesiaResponse.text();
            console.warn('TTS: Cartesia failed with status:', cartesiaResponse.status, errorText);
          }
        } catch (cartesiaError) {
          console.warn('TTS: Cartesia error:', cartesiaError);
        }
      } else {
        console.log('TTS: Cartesia API key not configured, skipping...');
      }

      const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (elevenlabsApiKey && elevenlabsApiKey !== 'your_elevenlabs_api_key_here') {
        try {
          console.log('TTS: Attempting ElevenLabs API...');
          const elevenlabsRequestBody = {
            text: limitedText,
            model_id: modelId || "eleven_multilingual_v2",
            voice_settings: {
              stability: stability || 0.6,
              similarity_boost: similarityBoost || 0.8
            }
          };

          const elevenlabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': elevenlabsApiKey
            },
            body: JSON.stringify(elevenlabsRequestBody)
          });

          if (elevenlabsResponse.ok) {
            const audioBuffer = await elevenlabsResponse.arrayBuffer();
            console.log('TTS: ElevenLabs success! Audio size:', audioBuffer.byteLength, 'bytes');
            res.set({
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.byteLength.toString(),
              'X-TTS-Provider': 'elevenlabs'
            });
            return res.send(Buffer.from(audioBuffer));
          } else {
            const errorText = await elevenlabsResponse.text();
            console.warn('TTS: ElevenLabs failed with status:', elevenlabsResponse.status, errorText);
          }
        } catch (elevenlabsError) {
          console.warn('TTS: ElevenLabs error:', elevenlabsError);
        }
      } else {
        console.log('TTS: ElevenLabs API key not configured, skipping...');
      }

      console.error('TTS: Both Cartesia and ElevenLabs failed');
      return res.status(503).json({
        message: "Speech synthesis unavailable - please check API configuration",
        error: "ALL_TTS_PROVIDERS_FAILED"
      });

    } catch (error) {
      console.error("Error in TTS endpoint:", error);
      res.status(500).json({
        message: "Internal server error during speech generation",
        error: "SERVER_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get college information
  app.get("/api/college-info", async (req, res) => {
    try {
      const { category, search } = req.query;
      let collegeInfo;
      if (search) {
        collegeInfo = await storage.searchCollegeInfo(search as string);
      } else if (category) {
        collegeInfo = await storage.getCollegeInfoByCategory(category as string);
      } else {
        collegeInfo = await storage.getCollegeInfo();
      }
      res.json(collegeInfo);
    } catch (error) {
      console.error("Error fetching college info:", error);
      res.status(500).json({ message: "Failed to fetch college information" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
