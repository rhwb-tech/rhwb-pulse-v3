import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Paper,
  TextField,
  Typography,
  Avatar,
  Fade,
  CircularProgress,
  Fab
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const GeminiChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your RHWB running assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<GoogleGenerativeAI | null>(null);

  // Initialize Gemini
  useEffect(() => {
    // Try both possible env var names (React requires REACT_APP_ prefix)
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY || process.env.CT_APP_GEMINI_API_KEY;
    if (apiKey) {
      chatRef.current = new GoogleGenerativeAI(apiKey);
    } else {
      console.error('Gemini API key not found. Make sure REACT_APP_GEMINI_API_KEY is set in .env.local');
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !chatRef.current) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get FileSearchStore name from environment
      const fileSearchStoreName = process.env.REACT_APP_FILE_SEARCH_STORE_NAME;

      // Use gemini-2.0-flash-exp model (similar to gemini-2.5-flash in working example)
      const modelName = process.env.REACT_APP_GEMINI_MODEL || 'gemini-2.0-flash-exp';

      console.log('[CHATBOT] Using model:', modelName, 'with file search store:', fileSearchStoreName);

      // Build conversation context from previous messages
      const conversationHistory = messages
        .filter((msg, index) => {
          // Skip the initial assistant greeting (first message)
          if (index === 0 && msg.role === 'assistant') return false;
          return true;
        })
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      // Build the full prompt with conversation context
      const fullPrompt = conversationHistory
        ? `${conversationHistory}\n\nUser: ${userMessage.content}\n\nAssistant:`
        : userMessage.content;

      // Configure model with file search tool (following working example structure)
      const generationConfig: any = {
        maxOutputTokens: 2000,
        temperature: 0.7,
      };

      // Add tools configuration for file search (matching working example)
      const tools: any[] = [];
      if (fileSearchStoreName) {
        tools.push({
          fileSearch: {
            fileSearchStoreNames: [fileSearchStoreName]
          }
        });
        console.log('[CHATBOT] File search enabled with store:', fileSearchStoreName);
      }

      const model = chatRef.current.getGenerativeModel({
        model: modelName,
        generationConfig,
        ...(tools.length > 0 && { tools })
      });

      // Use generateContent instead of startChat (matching working example pattern)
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      console.log('[CHATBOT] Response received:', text.substring(0, 100) + '...');

      const assistantMessage: Message = {
        role: 'assistant',
        content: text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Fab
          color="primary"
          aria-label="chat"
          onClick={toggleChat}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #0E5FD3 0%, #0A4EB0 100%)',
            },
            zIndex: 1000
          }}
        >
          <ChatIcon />
        </Fab>
      )}

      {/* Chat Window */}
      <Fade in={isOpen}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: { xs: 'calc(100vw - 32px)', sm: 400 },
            height: { xs: 'calc(100vh - 100px)', sm: 600 },
            display: isOpen ? 'flex' : 'none',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }}
        >
          {/* Header */}
          <Box sx={{
            background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
            color: 'white',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: 'white', color: '#1877F2', width: 40, height: 40 }}>
                <SmartToyIcon />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  RHWB Assistant
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Powered by Gemini
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={toggleChat} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            bgcolor: '#f8f9fa',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            {messages.map((message, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-start',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: message.role === 'user' ? '#1877F2' : '#e9ecef',
                    color: message.role === 'user' ? 'white' : '#1877F2',
                    flexShrink: 0
                  }}
                >
                  {message.role === 'user' ? <PersonIcon fontSize="small" /> : <SmartToyIcon fontSize="small" />}
                </Avatar>
                <Paper
                  elevation={1}
                  sx={{
                    p: 1.5,
                    maxWidth: '75%',
                    bgcolor: message.role === 'user' ? '#1877F2' : 'white',
                    color: message.role === 'user' ? 'white' : '#333',
                    borderRadius: 2,
                    wordWrap: 'break-word'
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.5,
                      opacity: 0.7,
                      fontSize: '0.65rem'
                    }}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Paper>
              </Box>
            ))}
            {isLoading && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#e9ecef', color: '#1877F2' }}>
                  <SmartToyIcon fontSize="small" />
                </Avatar>
                <Paper elevation={1} sx={{ p: 1.5, borderRadius: 2 }}>
                  <CircularProgress size={20} />
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box sx={{
            p: 2,
            bgcolor: 'white',
            borderTop: '1px solid #e9ecef'
          }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                size="small"
                multiline
                maxRows={3}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                sx={{
                  bgcolor: '#1877F2',
                  color: 'white',
                  '&:hover': {
                    bgcolor: '#0E5FD3'
                  },
                  '&:disabled': {
                    bgcolor: '#e9ecef',
                    color: '#999'
                  }
                }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Fade>
    </>
  );
};

export default GeminiChatBot;
