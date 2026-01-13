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
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
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
      content: 'Hi! I\'m Veer, your RHWB running assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<GoogleGenerativeAI | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      // Get FileSearchStore name and API key from environment
      const fileSearchStoreName = process.env.REACT_APP_FILE_SEARCH_STORE_NAME;
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || process.env.CT_APP_GEMINI_API_KEY;

      // Use gemini-2.0-flash-exp model
      //const modelName = process.env.REACT_APP_GEMINI_MODEL || 'gemini-2.0-flash-exp';
      const modelName = process.env.REACT_APP_GEMINI_MODEL;

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

      // Build request body matching Python SDK structure
      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts: [{ text: fullPrompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
        }
      };

      // Add file search tool if configured (matching Python SDK structure)
      if (fileSearchStoreName) {
        // Use the same format as Python example: fileSearchStores/store-id
        // No need for full projects/*/locations/global/ prefix
        const storeName = fileSearchStoreName.startsWith('fileSearchStores/')
          ? fileSearchStoreName
          : `fileSearchStores/${fileSearchStoreName}`;

        requestBody.tools = [
          {
            file_search: {
              file_search_store_names: [storeName]
            }
          }
        ];
        console.log('[CHATBOT] File search enabled with store:', storeName);
      }

      // Call Gemini REST API directly
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CHATBOT] API Error:', errorData);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;

      console.log('[CHATBOT] Response received:', text.substring(0, 100) + '...');

      const assistantMessage: Message = {
        role: 'assistant',
        content: text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Refocus input after response
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);

      // Refocus input after error
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
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
            background: 'transparent',
            boxShadow: 'none',
            '&:hover': {
              background: 'transparent',
              boxShadow: 'none',
            },
            zIndex: 1000,
            width: 56,
            height: 56,
            padding: 0
          }}
        >
          <img
            src="/veer-avatar.png"
            alt="Veer"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
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
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src="/veer-avatar.png"
                  alt="Veer"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  Veer
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
                {message.role === 'user' ? (
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: '#1877F2',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    <PersonIcon fontSize="small" />
                  </Avatar>
                ) : (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img
                      src="/veer-avatar.png"
                      alt="Veer"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                )}
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
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img
                    src="/veer-avatar.png"
                    alt="Veer"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
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
                inputRef={inputRef}
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
