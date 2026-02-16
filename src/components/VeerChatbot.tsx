import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Paper,
  TextField,
  Typography,
  Avatar,
  Fade,
  CircularProgress,
  Fab,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  Snackbar,
  Collapse,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import SportsIcon from '@mui/icons-material/Sports';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import AirIcon from '@mui/icons-material/Air';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from './supabaseClient';
import MarkdownMessage from './MarkdownMessage';
import queryContextData from '../config/queryContext.json';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  feedback?: 'up' | 'down' | null;
}

interface WorkoutRow {
  id?: string;
  workout_name: string;
  description: string;
  planned_distance?: string;
  activity: string;
  workout_date: string;
  first_name?: string;
  last_name?: string;
  zip?: string;
  fitness_level?: string;
  goals?: string;
  subscription_tier?: string;
  coach_name?: string;
  season?: string;
  meso?: string;
  week_number?: number;
  email_id?: string;
  [key: string]: any; // capture any additional fields
}

interface WeatherInfo {
  temp: number;
  conditions: string;
  wind: number;
  icon: string;
}

interface VeerChatbotProps {
  fullPage?: boolean;
}

// YouTube URL regex - only match actual video URLs (with watch?v= or youtu.be/VIDEO_ID)
const YOUTUBE_URL_RE = /https?:\/\/(www\.)?(youtube\.com\/watch\?[^\s]*v=[a-zA-Z0-9_-]{11}[^\s]*|youtu\.be\/[a-zA-Z0-9_-]{11}[^\s]*)/g;

function extractYouTubeUrls(text: string): string[] {
  return text?.match(YOUTUBE_URL_RE) || [];
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const videoId = u.pathname.slice(1); // remove leading /
      if (videoId && videoId.length >= 11) {
        return `https://www.youtube.com/embed/${videoId.substring(0, 11)}`;
      }
    }
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
  } catch { /* ignore */ }
  return null;
}

function stripYouTubeUrls(text: string): string {
  return text?.replace(YOUTUBE_URL_RE, '').trim() || '';
}

function isOutdoorActivity(activity: string): boolean {
  if (!activity) return false;
  const a = activity.toLowerCase();
  return a.includes('run') || a.includes('walk');
}

function getActivityIcon(activity: string) {
  const a = activity?.toLowerCase() || '';
  if (a.includes('strength') || a.includes('cross')) return <FitnessCenterIcon fontSize="small" sx={{ color: '#1877F2' }} />;
  if (a.includes('run')) return <DirectionsRunIcon fontSize="small" sx={{ color: '#1877F2' }} />;
  if (a.includes('walk')) return <DirectionsWalkIcon fontSize="small" sx={{ color: '#1877F2' }} />;
  if (a.includes('rest')) return <SelfImprovementIcon fontSize="small" sx={{ color: '#1877F2' }} />;
  return <SportsIcon fontSize="small" sx={{ color: '#1877F2' }} />;
}

function getSuggestionChips(activity: string, hasWeather: boolean): string[] {
  const a = activity?.toLowerCase() || '';
  if (a.includes('strength') || a.includes('cross')) {
    return ['Best leg workouts for runners', 'Core exercises for runners'];
  }
  if (isOutdoorActivity(a)) {
    return hasWeather
      ? ['How should I adjust my workout for this weather?', 'How to pace a long run']
      : ['How to pace a long run', 'Running tips for beginners'];
  }
  if (a.includes('rest')) {
    return ['Active recovery tips', 'Best stretches for runners'];
  }
  return ['Running tips for beginners', 'How to prevent injuries'];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to call the veer-data Edge Function (all Veer data goes through Cloud SQL)
async function callVeerEdgeFunction(payload: Record<string, unknown>, timeoutMs = 8000): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No active session');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/veer-data`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Edge function error: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

const VeerChatbot: React.FC<VeerChatbotProps> = ({ fullPage = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useRhwbSources, setUseRhwbSources] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    return !localStorage.getItem(`veer_disclaimer_seen_${user?.email}`);
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down' | null>>({});
  const [feedbackComment, setFeedbackComment] = useState<Record<string, string>>({});
  const [feedbackCommentSaved, setFeedbackCommentSaved] = useState<Record<string, boolean>>({});

  // Workout related state
  const [workoutData, setWorkoutData] = useState<{ today: WorkoutRow[]; tomorrow: WorkoutRow[] } | null>(null);
  const [firstName, setFirstName] = useState<string>('');
  const [expandedWorkout, setExpandedWorkout] = useState<Record<string, boolean>>({});
  const [expandedVideo, setExpandedVideo] = useState<Record<string, boolean>>({});
  const [formattedDescriptions, setFormattedDescriptions] = useState<Record<string, string>>({});
  const [weatherData, setWeatherData] = useState<{
    today: WeatherInfo | null;
    tomorrow: WeatherInfo | null;
  }>({ today: null, tomorrow: null });
  const [greetingMessageId, setGreetingMessageId] = useState<string>('');
  const [userProfileData, setUserProfileData] = useState<WorkoutRow | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper function to get initials from name or email
  const getInitials = (name: string): string => {
    if (!name) return '?';
    // If it's an email, use first letter of local part
    if (name.includes('@')) {
      return name.split('@')[0].charAt(0).toUpperCase();
    }
    // Otherwise get initials from name parts
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  };

  // Fetch user profile picture
  useEffect(() => {
    if (!user?.email) return;

    const fetchProfilePicture = async () => {
      const userEmail = user.email!.toLowerCase();
      const role = user.role;

      // Admin table has different columns (admin_name instead of first_name/last_name)
      if (role === 'admin') {
        try {
          const { data } = await supabase
            .from('rhwb_admin')
            .select('profile_picture, admin_name')
            .eq('email_id', userEmail)
            .single();

          if (data?.profile_picture) setProfilePicture(data.profile_picture);
          if (data?.admin_name) setDisplayName(data.admin_name);
          return;
        } catch {
          return;
        }
      }

      // Coach/hybrid: rhwb_coaches has 'coach' (name) not first_name/last_name
      if (role === 'coach' || role === 'hybrid') {
        try {
          const { data } = await supabase
            .from('rhwb_coaches')
            .select('profile_picture, coach')
            .eq('email_id', userEmail)
            .single();

          if (data?.profile_picture) setProfilePicture(data.profile_picture);
          if (data?.coach) setDisplayName(data.coach);

          // Fallback to runners_profile if no picture in coaches table
          if (!data?.profile_picture) {
            const { data: runnerData } = await supabase
              .from('runners_profile')
              .select('profile_picture, first_name, last_name')
              .eq('email_id', userEmail)
              .single();
            if (runnerData?.profile_picture) setProfilePicture(runnerData.profile_picture);
            if (!data?.coach && runnerData?.first_name) {
              const fullName = runnerData.last_name
                ? `${runnerData.first_name} ${runnerData.last_name}`
                : runnerData.first_name;
              setDisplayName(fullName);
            }
          }
        } catch (err) {
          console.error('[VEER] Error fetching coach profile:', err);
        }
        return;
      }

      // Runner: runners_profile has first_name/last_name
      try {
        const { data, error } = await supabase
          .from('runners_profile')
          .select('profile_picture, first_name, last_name')
          .eq('email_id', userEmail)
          .single();

        if (error || !data) return;

        if (data.profile_picture) {
          setProfilePicture(data.profile_picture);
        }
        if (data.first_name) {
          const fullName = data.last_name
            ? `${data.first_name} ${data.last_name}`
            : data.first_name;
          setDisplayName(fullName);
        }
      } catch (err) {
        console.error('[VEER] Error fetching profile picture:', err);
      }
    };

    fetchProfilePicture();
  }, [user?.email, user?.role]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen || fullPage) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, fullPage]);

  // Fetch workouts and weather when chat opens
  useEffect(() => {
    if (!user?.email || (!isOpen && !fullPage)) return;

    const fetchWorkoutsAndWeather = async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      let data: WorkoutRow[];
      try {
        const result = await callVeerEdgeFunction({
          action: 'get-workouts',
          dates: [fmt(today), fmt(tomorrow)],
        });
        data = (result.data as WorkoutRow[]) || [];
      } catch (err) {
        console.error('[VEER] Error fetching workouts:', err);
        return;
      }
      if (data.length === 0) return;

      const name = data[0].first_name || user.email!.split('@')[0];
      const zip = data[0].zip || '';
      setUserProfileData(data[0]);
      const todayStr = fmt(today);
      const tomorrowStr = fmt(tomorrow);
      const todayWorkouts = data.filter((w: WorkoutRow) => w.workout_date === todayStr);
      const tomorrowWorkouts = data.filter((w: WorkoutRow) => w.workout_date === tomorrowStr);

      setFirstName(name);
      setWorkoutData({ today: todayWorkouts, tomorrow: tomorrowWorkouts });

      // Set greeting message
      const gId = generateId();
      setGreetingMessageId(gId);
      setMessages([{
        id: gId,
        role: 'assistant',
        content: '__greeting__',
        timestamp: new Date()
      }]);

      // Fetch weather for outdoor activities
      const todayHasOutdoor = todayWorkouts.some((w: WorkoutRow) => isOutdoorActivity(w.activity));
      const tomorrowHasOutdoor = tomorrowWorkouts.some((w: WorkoutRow) => isOutdoorActivity(w.activity));
      const weatherKey = process.env.REACT_APP_OPENWEATHERMAP_API_KEY;

      if (zip && weatherKey && (todayHasOutdoor || tomorrowHasOutdoor)) {
        try {
          let todayWeather: WeatherInfo | null = null;
          if (todayHasOutdoor) {
            const todayRes = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?zip=${zip},us&appid=${weatherKey}&units=imperial`
            );
            if (todayRes.ok) {
              const w = await todayRes.json();
              todayWeather = {
                temp: Math.round(w.main?.temp || 0),
                conditions: w.weather?.[0]?.description || 'unknown',
                wind: Math.round(w.wind?.speed || 0),
                icon: w.weather?.[0]?.icon || ''
              };
            }
          }

          let tomorrowWeather: WeatherInfo | null = null;
          if (tomorrowHasOutdoor) {
            const forecastRes = await fetch(
              `https://api.openweathermap.org/data/2.5/forecast?zip=${zip},us&appid=${weatherKey}&units=imperial`
            );
            if (forecastRes.ok) {
              const forecast = await forecastRes.json();
              const tomorrowDateStr = fmt(tomorrow);

              const tomorrowForecasts = forecast.list?.filter((f: { dt_txt: string }) =>
                f.dt_txt.startsWith(tomorrowDateStr)
              ) || [];

              const noonForecast = tomorrowForecasts.find((f: { dt_txt: string }) =>
                f.dt_txt.includes('12:00')
              ) || tomorrowForecasts[Math.floor(tomorrowForecasts.length / 2)] || tomorrowForecasts[0];

              if (noonForecast) {
                tomorrowWeather = {
                  temp: Math.round(noonForecast.main?.temp || 0),
                  conditions: noonForecast.weather?.[0]?.description || 'unknown',
                  wind: Math.round(noonForecast.wind?.speed || 0),
                  icon: noonForecast.weather?.[0]?.icon || ''
                };
              }
            }
          }

          setWeatherData({ today: todayWeather, tomorrow: tomorrowWeather });
        } catch (e) {
          console.error('[VEER] Failed to fetch weather:', e);
        }
      }

      // Format descriptions via Edge Function → Cloud Run → Vertex AI
      const allWorkouts = [
        ...todayWorkouts.map((w: WorkoutRow, i: number) => ({ key: `today-${i}`, desc: w.description })),
        ...tomorrowWorkouts.map((w: WorkoutRow, i: number) => ({ key: `tomorrow-${i}`, desc: w.description }))
      ].filter(item => item.desc?.trim());

      if (allWorkouts.length > 0) {
        try {
          const fmtResult = await callVeerEdgeFunction({
            action: 'format-descriptions',
            descriptions: Object.fromEntries(allWorkouts.map(w => [w.key, w.desc])),
          });
          if (fmtResult.data && typeof fmtResult.data === 'object') {
            setFormattedDescriptions(fmtResult.data as Record<string, string>);
          }
        } catch (e) {
          console.error('[VEER] Failed to format descriptions:', e);
        }
      }
    };

    fetchWorkoutsAndWeather();
  }, [user?.email, isOpen, fullPage]);

  // Get priority instruction based on user query
  const getPriorityInstruction = (query: string): string | null => {
    const lowerQuery = query.toLowerCase();
    for (const item of queryContextData.priorityInstructions) {
      if (item.keywords.some(keyword => lowerQuery.includes(keyword))) {
        return item.instruction;
      }
    }
    return null;
  };

  // Send message via Edge Function → Cloud Run → Vertex AI (HIPAA-compliant)
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history (skip greeting message)
      const conversationHistory = messages
        .filter((msg, index) => !(index === 0 && msg.role === 'assistant'))
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const priorityInstruction = getPriorityInstruction(messageText);

      const result = await callVeerEdgeFunction({
        action: 'chat',
        message: messageText,
        conversationHistory: conversationHistory || null,
        useRhwbSources,
        priorityInstruction: priorityInstruction && useRhwbSources ? priorityInstruction : null,
        weatherData,
      }, 30000); // 30s timeout for AI responses

      const responseText = (result.data as any)?.response;
      if (!responseText) {
        throw new Error('No response from AI');
      }

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('[VEER] Error:', error);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isLoading, useRhwbSources, weatherData]);

  const handleSendMessage = () => sendMessage(input);

  const handleChipClick = useCallback((label: string, dayKey?: string) => {
    if (label.toLowerCase().includes('adjust my workout for this weather')) {
      const dayWeather = dayKey === 'tomorrow' ? weatherData.tomorrow : weatherData.today;
      if (dayWeather) {
        const activity = dayKey === 'tomorrow'
          ? workoutData?.tomorrow?.[0]?.activity || 'workout'
          : workoutData?.today?.[0]?.activity || 'workout';
        const dayLabel = dayKey === 'tomorrow' ? 'tomorrow' : 'today';
        const prompt = `The weather ${dayLabel} is ${dayWeather.conditions}, ${dayWeather.temp}°F with ${dayWeather.wind} mph wind. ${label} I'm doing a ${activity} ${dayLabel}.`;
        sendMessage(prompt);
      } else {
        sendMessage(label);
      }
    } else {
      sendMessage(label);
    }
  }, [weatherData, workoutData, sendMessage]);

  // Handle feedback
  const handleFeedback = async (messageId: string, type: 'up' | 'down') => {
    const current = feedback[messageId] ?? null;
    const newType = current === type ? null : type;
    setFeedback(prev => ({ ...prev, [messageId]: newType }));

    try {
      if (newType) {
        // Find the assistant message and the preceding user question
        const msgIndex = messages.findIndex(m => m.id === messageId);
        const assistantMessage = messages[msgIndex];
        let userQuestion = '';
        if (msgIndex > 0) {
          for (let i = msgIndex - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
              userQuestion = messages[i].content;
              break;
            }
          }
        }

        await callVeerEdgeFunction({
          action: 'upsert-feedback',
          message_id: messageId,
          feedback: newType,
          user_question: userQuestion || null,
          assistant_response: assistantMessage?.content || null,
        });
      } else {
        await callVeerEdgeFunction({
          action: 'delete-feedback',
          message_id: messageId,
        });
      }
    } catch (err) {
      console.error('[VEER] Error storing feedback:', err);
    }
  };

  // Save feedback comment
  const saveFeedbackComment = async (messageId: string) => {
    const comment = feedbackComment[messageId]?.trim();
    if (!comment) return;

    try {
      await callVeerEdgeFunction({
        action: 'update-feedback-comment',
        message_id: messageId,
        comment,
      });
      setFeedbackCommentSaved(prev => ({ ...prev, [messageId]: true }));
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      console.error('[VEER] Error saving feedback comment:', err);
    }
  };

  const toggleWorkout = (key: string) => {
    setExpandedWorkout(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleVideo = (key: string) => {
    setExpandedVideo(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Export chat
  const exportChat = (format: 'txt' | 'md' | 'json') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let content: string;
    let filename: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(messages, null, 2);
        filename = `veer-chat-${timestamp}.json`;
        break;
      case 'md':
        content = messages.map(m => {
          const time = m.timestamp.toLocaleString();
          const role = m.role === 'user' ? '**You**' : '**Veer**';
          return `### ${role} (${time})\n\n${m.content}\n`;
        }).join('\n---\n\n');
        filename = `veer-chat-${timestamp}.md`;
        break;
      default:
        content = messages.map(m => {
          const time = m.timestamp.toLocaleString();
          const role = m.role === 'user' ? 'You' : 'Veer';
          return `[${time}] ${role}:\n${m.content}\n`;
        }).join('\n---\n\n');
        filename = `veer-chat-${timestamp}.txt`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setMenuAnchor(null);
    showSnackbar(`Chat exported as ${format.toUpperCase()}`);
  };

  const copyChat = async () => {
    const content = messages.map(m => {
      const role = m.role === 'user' ? 'You' : 'Veer';
      return `${role}: ${m.content}`;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(content);
      showSnackbar('Chat copied to clipboard');
    } catch {
      showSnackbar('Failed to copy chat');
    }
    setMenuAnchor(null);
  };

  const clearChat = () => {
    setMessages([{
      id: generateId(),
      role: 'assistant',
      content: "Hi! How can I help you today?",
      timestamp: new Date()
    }]);
    setMenuAnchor(null);
    showSnackbar('Chat cleared');
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => setIsOpen(!isOpen);
  const expandToFullPage = () => {
    setIsOpen(false); // Close floating widget before navigating
    navigate('/veer');
  };
  const shrinkToWidget = () => navigate('/');

  // Render workout section
  const renderWorkoutSection = (label: string, key: string, workouts: WorkoutRow[]) => {
    if (workouts.length === 0) return null;
    const isExpanded = expandedWorkout[key] || false;
    const hasOutdoorWorkout = workouts.some(w => isOutdoorActivity(w.activity));
    const dayWeather = key === 'today' ? weatherData.today : key === 'tomorrow' ? weatherData.tomorrow : null;
    const showWeather = hasOutdoorWorkout && dayWeather;
    const uniqueActivities = Array.from(new Set(workouts.map(w => w.activity).filter(Boolean)));
    const headerActivity = uniqueActivities.join(' + ');

    const allChips = new Set<string>();
    workouts.forEach(w => {
      const workoutIsOutdoor = isOutdoorActivity(w.activity);
      getSuggestionChips(w.activity, !!(showWeather && workoutIsOutdoor)).forEach(chip => allChips.add(chip));
    });

    return (
      <Box key={key} sx={{ mb: 1 }}>
        <Box
          onClick={() => toggleWorkout(key)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            py: 0.5,
            '&:hover': { bgcolor: '#f0f4ff', borderRadius: 1 }
          }}
        >
          {isExpanded ? <ExpandLessIcon fontSize="small" sx={{ color: '#1877F2' }} /> : <ExpandMoreIcon fontSize="small" sx={{ color: '#1877F2' }} />}
          {getActivityIcon(workouts[0]?.activity || '')}
          <Typography variant="body2" sx={{ fontWeight: 600, ml: 0.5 }}>
            {label}: {headerActivity}
          </Typography>
        </Box>
        <Collapse in={isExpanded}>
          <Box sx={{ pl: 3.5, pt: 0.5 }}>
            {/* Weather highlights */}
            {showWeather && dayWeather && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 1.5,
                p: 1,
                bgcolor: '#f0f7ff',
                borderRadius: 1,
                border: '1px solid #d0e3ff'
              }}>
                {(dayWeather.icon || '').includes('01') || (dayWeather.icon || '').includes('02') ? (
                  <WbSunnyIcon sx={{ color: '#f9a825', fontSize: 20 }} />
                ) : (
                  <CloudIcon sx={{ color: '#78909c', fontSize: 20 }} />
                )}
                <Typography variant="caption" sx={{ fontWeight: 500, color: '#333' }}>
                  {dayWeather.temp}°F, {dayWeather.conditions}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <AirIcon sx={{ color: '#78909c', fontSize: 16 }} />
                  <Typography variant="caption" sx={{ color: '#555' }}>
                    {dayWeather.wind} mph
                  </Typography>
                </Box>
                {key === 'tomorrow' && (
                  <Typography variant="caption" sx={{ color: '#888', fontStyle: 'italic' }}>
                    (forecast)
                  </Typography>
                )}
              </Box>
            )}

            {workouts.map((w, i) => {
              const youtubeUrls = extractYouTubeUrls(w.description || '');
              const videoKey = `${key}-${i}`;
              const displayDesc = formattedDescriptions[videoKey] || stripYouTubeUrls(w.description || '');
              const showWorkoutIcon = workouts.length > 1;

              return (
                <Box key={i} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {showWorkoutIcon && getActivityIcon(w.activity)}
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {w.workout_name}
                    </Typography>
                    {showWorkoutIcon && w.activity && (
                      <Typography variant="caption" sx={{ color: '#888', ml: 0.5 }}>
                        ({w.activity})
                      </Typography>
                    )}
                  </Box>
                  {displayDesc && (
                    <Typography variant="caption" sx={{ color: '#666', display: 'block' }}>
                      {displayDesc}
                    </Typography>
                  )}
                  {w.planned_distance && (
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Distance: {w.planned_distance} mi
                    </Typography>
                  )}
                  {youtubeUrls.length > 0 && (
                    <Box sx={{ mt: 0.5 }}>
                      <Box
                        onClick={(e) => { e.stopPropagation(); toggleVideo(videoKey); }}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          color: '#1877F2',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
                          {expandedVideo[videoKey] ? 'Hide Video' : 'Watch Video'}
                        </Typography>
                        {expandedVideo[videoKey] ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                      </Box>
                      <Collapse in={expandedVideo[videoKey] || false}>
                        <Box sx={{ mt: 0.5 }}>
                          {youtubeUrls.map((url, vi) => {
                            const embedUrl = toEmbedUrl(url);
                            if (!embedUrl) return null;
                            return (
                              <Box
                                key={vi}
                                component="iframe"
                                src={embedUrl}
                                sx={{
                                  width: '100%',
                                  maxWidth: 400,
                                  height: 225,
                                  border: 'none',
                                  borderRadius: 1,
                                  mt: 0.5
                                }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            );
                          })}
                        </Box>
                      </Collapse>
                    </Box>
                  )}
                </Box>
              );
            })}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
              {Array.from(allChips).map((chipLabel) => (
                <Chip
                  key={chipLabel}
                  label={chipLabel}
                  size="small"
                  onClick={() => handleChipClick(chipLabel, key)}
                  sx={{
                    bgcolor: '#e8f0fe',
                    color: '#1877F2',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    '&:hover': { bgcolor: '#d2e3fc' },
                    cursor: 'pointer'
                  }}
                />
              ))}
            </Box>
          </Box>
        </Collapse>
      </Box>
    );
  };

  // Render greeting with workouts
  const renderGreeting = () => {
    if (!workoutData) return null;

    return (
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
          Hi <strong>{firstName}</strong>!
        </Typography>
        {renderWorkoutSection("Today's Workout", 'today', workoutData.today)}
        {renderWorkoutSection("Tomorrow's Workout", 'tomorrow', workoutData.tomorrow)}
        <Typography variant="body2" sx={{ mt: 1, color: '#555' }}>
          How can I help you today?
        </Typography>
      </Box>
    );
  };

  // Render chat content
  const renderChatContent = () => (
    <>
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1877F2 0%, #0E5FD3 100%)',
          color: 'white',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40 }}>
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
              RHWB Helpdesk AI Assistant
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!fullPage && (
            <Tooltip title="Expand to full page">
              <IconButton onClick={expandToFullPage} sx={{ color: 'white' }} size="small">
                <OpenInFullIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {fullPage && (
            <Tooltip title="Minimize to floating widget">
              <IconButton onClick={shrinkToWidget} sx={{ color: 'white' }} size="small">
                <CloseFullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: 'white' }} size="small">
            <MoreVertIcon fontSize="small" />
          </IconButton>
          {!fullPage && (
            <IconButton onClick={toggleChat} sx={{ color: 'white' }} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => exportChat('txt')}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Export as Text</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => exportChat('md')}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Export as Markdown</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => exportChat('json')}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Export as JSON</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={copyChat}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Copy Chat</ListItemText>
        </MenuItem>
        <MenuItem onClick={clearChat}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Clear Chat</ListItemText>
        </MenuItem>
      </Menu>

      {/* Disclaimer */}
      {showDisclaimer && (
        <Box sx={{
          bgcolor: '#fff3e0',
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #ffe0b2'
        }}>
          <Typography variant="caption" sx={{ color: '#e65100' }}>
            <strong>Disclaimer:</strong> Veer provides general information and educational guidance only. Always consult a qualified medical professional or your coach for personalized advice.
          </Typography>
          <IconButton
            size="small"
            onClick={() => {
              setShowDisclaimer(false);
              localStorage.setItem(`veer_disclaimer_seen_${user?.email}`, 'true');
            }}
            sx={{ ml: 1, color: '#e65100' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          bgcolor: '#f8f9fa',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            {message.role === 'user' ? (
              <Avatar
                src={profilePicture || undefined}
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: '#1877F2',
                  flexShrink: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {!profilePicture && getInitials(displayName || firstName || user?.email || '')}
              </Avatar>
            ) : (
              <Box sx={{ width: 36, height: 36, flexShrink: 0 }}>
                <img src="/veer-avatar.png" alt="Veer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
            )}
            <Paper
              elevation={1}
              sx={{
                p: 2,
                maxWidth: { xs: '85%', sm: '75%' },
                bgcolor: message.role === 'user' ? '#1877F2' : 'white',
                color: message.role === 'user' ? 'white' : '#333',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              {message.role === 'user' ? (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
              ) : message.id === greetingMessageId && workoutData ? (
                renderGreeting()
              ) : (
                <MarkdownMessage content={message.content} />
              )}
              <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7, fontSize: '0.65rem' }}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              {message.role === 'assistant' && (
                <Box sx={{ mt: 0.5 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleFeedback(message.id, 'up')}
                      sx={{ p: 0.5, color: feedback[message.id] === 'up' ? '#1877F2' : '#999' }}
                    >
                      {feedback[message.id] === 'up' ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleFeedback(message.id, 'down')}
                      sx={{ p: 0.5, color: feedback[message.id] === 'down' ? '#d32f2f' : '#999' }}
                    >
                      {feedback[message.id] === 'down' ? <ThumbDownIcon fontSize="small" /> : <ThumbDownOutlinedIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                  <Collapse in={feedback[message.id] === 'down' && !feedbackCommentSaved[message.id]}>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'flex-start' }}>
                      <TextField
                        size="small"
                        placeholder="Add a comment (optional)"
                        value={feedbackComment[message.id] || ''}
                        onChange={(e) => setFeedbackComment(prev => ({ ...prev, [message.id]: e.target.value }))}
                        multiline
                        maxRows={3}
                        sx={{
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1.5,
                            fontSize: '0.75rem',
                          },
                          '& .MuiOutlinedInput-input': {
                            py: 0.75,
                            px: 1,
                          },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => saveFeedbackComment(message.id)}
                        disabled={!feedbackComment[message.id]?.trim()}
                        sx={{
                          color: feedbackCommentSaved[message.id] ? '#4caf50' : '#1877F2',
                          '&:disabled': { color: '#ccc' },
                        }}
                      >
                        {feedbackCommentSaved[message.id] ? <CheckIcon fontSize="small" /> : <SendIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Paper>
          </Box>
        ))}
        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Box sx={{ width: 36, height: 36, flexShrink: 0 }}>
              <img src="/veer-avatar.png" alt="Veer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </Box>
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
              <CircularProgress size={20} />
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Paper elevation={3} sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={useRhwbSources}
                onChange={(e) => setUseRhwbSources(e.target.checked)}
                size="small"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#1877F2' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#1877F2' },
                }}
              />
            }
            label={
              <Typography variant="body2" sx={{ color: useRhwbSources ? '#1877F2' : '#999', fontWeight: 500 }}>
                RHWB Sources
              </Typography>
            }
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder="Ask Veer anything about running..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            size="small"
            multiline
            maxRows={4}
            inputRef={inputRef}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <IconButton
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            sx={{
              bgcolor: '#1877F2',
              color: 'white',
              '&:hover': { bgcolor: '#0E5FD3' },
              '&:disabled': { bgcolor: '#e9ecef', color: '#999' },
              borderRadius: 2,
              px: 2
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </>
  );

  const snackbar = (
    <Snackbar
      open={snackbarOpen}
      autoHideDuration={3000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
        {snackbarMessage}
      </Alert>
    </Snackbar>
  );

  // Full page mode
  if (fullPage) {
    return (
      <Box
        sx={{
          height: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 800,
          mx: 'auto',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
      >
        {renderChatContent()}
        {snackbar}
      </Box>
    );
  }

  // Floating widget mode
  return (
    <>
      {/* Floating Chat Button - positioned above the filter FAB */}
      {!isOpen && (
        <Fab
          color="primary"
          aria-label="chat"
          onClick={toggleChat}
          sx={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 144px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 24px)',
            background: 'transparent',
            boxShadow: 'none',
            '&:hover': { background: 'transparent', boxShadow: 'none' },
            zIndex: 1000,
            width: 56,
            height: 56,
            padding: 0,
          }}
        >
          <img src="/veer-avatar.png" alt="Veer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          {renderChatContent()}
        </Paper>
      </Fade>

      {snackbar}
    </>
  );
};

export default VeerChatbot;
