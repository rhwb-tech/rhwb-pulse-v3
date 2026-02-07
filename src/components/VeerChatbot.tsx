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

      // Determine which table to query based on role
      let tableName = 'runners_profile';
      if (role === 'admin') tableName = 'rhwb_admin';
      else if (role === 'coach' || role === 'hybrid') tableName = 'rhwb_coaches';

      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('profile_picture, first_name, last_name')
          .eq('email_id', userEmail)
          .single();

        if (error || !data) {
          // If no profile found in role-specific table, try runners_profile as fallback
          if (tableName !== 'runners_profile') {
            const { data: runnerData } = await supabase
              .from('runners_profile')
              .select('profile_picture, first_name, last_name')
              .eq('email_id', userEmail)
              .single();

            if (runnerData?.profile_picture) {
              setProfilePicture(runnerData.profile_picture);
            }
            if (runnerData?.first_name) {
              const fullName = runnerData.last_name
                ? `${runnerData.first_name} ${runnerData.last_name}`
                : runnerData.first_name;
              setDisplayName(fullName);
            }
          }
          return;
        }

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

      const { data, error } = await supabase
        .from('veer_user_workouts')
        .select('*')
        .eq('email_id', user.email!.toLowerCase())
        .in('workout_date', [fmt(today), fmt(tomorrow)]);

      if (error) {
        console.error('[VEER] Error fetching workouts:', error);
        return;
      }
      if (!data || data.length === 0) return;

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

      // Format descriptions via Gemini
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      const modelName = process.env.REACT_APP_GEMINI_MODEL || 'gemini-2.0-flash-exp';

      if (apiKey) {
        const allWorkouts = [
          ...todayWorkouts.map((w: WorkoutRow, i: number) => ({ key: `today-${i}`, desc: w.description })),
          ...tomorrowWorkouts.map((w: WorkoutRow, i: number) => ({ key: `tomorrow-${i}`, desc: w.description }))
        ].filter(item => item.desc?.trim());

        if (allWorkouts.length > 0) {
          try {
            const prompt = `Format each workout description below into a clean, concise summary (1-2 sentences max). Remove URLs. Return ONLY valid JSON object mapping keys to formatted strings, nothing else.\n\n${JSON.stringify(
              Object.fromEntries(allWorkouts.map(w => [w.key, w.desc]))
            )}`;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const res = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: 'Return only valid JSON. No markdown, no explanation.' }] },
                generationConfig: { maxOutputTokens: 2000, temperature: 0.2 }
              })
            });
            if (res.ok) {
              const result = await res.json();
              const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
              try {
                const parsed = JSON.parse(cleaned);
                setFormattedDescriptions(parsed);
              } catch (parseErr) {
                console.warn('[VEER] Could not parse formatted descriptions:', parseErr);
              }
            }
          } catch (e) {
            console.error('[VEER] Failed to format descriptions:', e);
          }
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

  // Build user context string from workout/profile data
  const buildUserContext = useCallback((): string => {
    if (!userProfileData) return '';

    const lines: string[] = ['--- CURRENT USER CONTEXT ---'];

    // Keys to skip (these are workout-specific fields handled separately below)
    const skipKeys = new Set([
      'id', 'created_at', 'updated_at', 'workout_name', 'description',
      'planned_distance', 'workout_date'
    ]);

    // Friendly label mapping for known keys
    const labelMap: Record<string, string> = {
      first_name: 'First Name',
      last_name: 'Last Name',
      email_id: 'Email',
      zip: 'Location (ZIP)',
      fitness_level: 'Fitness Level',
      goals: 'Current Goal',
      subscription_tier: 'Subscription Tier',
      coach_name: 'Coach',
      coach: 'Coach',
      coach_email: 'Coach Email',
      season: 'Season',
      meso: 'Meso',
      week_number: 'Week',
      activity: 'Activity Type',
      group_name: 'Group',
      program: 'Program',
      level: 'Level',
      pace_zone: 'Pace Zone',
      target_pace: 'Target Pace',
    };

    // Dynamically include all non-empty fields from the user profile row
    for (const [key, value] of Object.entries(userProfileData)) {
      if (skipKeys.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`${label}: ${value}`);
    }

    // Today's workouts
    if (workoutData?.today && workoutData.today.length > 0) {
      lines.push('');
      lines.push("Today's Workouts:");
      workoutData.today.forEach((w, i) => {
        lines.push(`  ${i + 1}. ${w.workout_name} (${w.activity})`);
        if (w.planned_distance) lines.push(`     Distance: ${w.planned_distance} mi`);
        if (w.description) lines.push(`     Details: ${stripYouTubeUrls(w.description).substring(0, 200)}`);
      });
    }

    // Tomorrow's workouts
    if (workoutData?.tomorrow && workoutData.tomorrow.length > 0) {
      lines.push('');
      lines.push("Tomorrow's Workouts:");
      workoutData.tomorrow.forEach((w, i) => {
        lines.push(`  ${i + 1}. ${w.workout_name} (${w.activity})`);
        if (w.planned_distance) lines.push(`     Distance: ${w.planned_distance} mi`);
        if (w.description) lines.push(`     Details: ${stripYouTubeUrls(w.description).substring(0, 200)}`);
      });
    }

    // Weather
    if (weatherData.today) {
      lines.push('');
      lines.push(`Today's Weather: ${weatherData.today.temp}°F, ${weatherData.today.conditions}, wind ${weatherData.today.wind} mph`);
    }
    if (weatherData.tomorrow) {
      lines.push(`Tomorrow's Forecast: ${weatherData.tomorrow.temp}°F, ${weatherData.tomorrow.conditions}, wind ${weatherData.tomorrow.wind} mph`);
    }

    lines.push('----------------------------');

    return '\n\n' + lines.join('\n');
  }, [userProfileData, workoutData, weatherData]);

  // Build system instruction - wrapped in useCallback for stable reference
  const buildSystemInstruction = useCallback((): string => {
    const userContext = buildUserContext();

    if (!useRhwbSources) {
      return 'You are Veer, a helpful running assistant. Answer questions about running, training, nutrition, and fitness using your general knowledge.' + userContext;
    }

    return `You are Veer, a helpful running assistant for RHWB (Run Happy With Bhumika).

CRITICAL RULE: When a coach profile has an [Image Source] field containing a URL, you MUST include it as the FIRST line of your response using this exact markdown syntax:
![Coach Name](the_exact_image_url)

The source documents use three formats:

1) Coach profiles have fields: [Role], [Coach Name], [Profile Description], [Image Source], [Profile URL]
2) YouTube transcripts have fields: Video Title, Video URL, Video ID, Description, TRANSCRIPT START/END
3) Blog posts have fields: Title, Description, URL, Image URL (optional), Blog Text Start/End

Rules for each source type:

PERSON QUERIES:
When the user asks about a specific person:
1. FIRST, find and present their coach profile (image, description, profile link) as described below
2. THEN, search for that person's name across ALL other sources (blog posts, YouTube videos) and include any additional content where they are mentioned or featured
3. Present the additional content after the profile summary, grouped by type

COACH PROFILES:
- ALWAYS include the image first: ![Coach Name](image_url) using the exact [Image Source] URL
- If [Image Source] is empty, skip the image
- Summarize [Profile Description] in 2-3 sentences
- Link to profile: [View Profile](profile_url)

YOUTUBE VIDEOS:
- Include the video link on its own line: [Video Title](video_url)
- Summarize the key points, do NOT quote the raw transcript

BLOG POSTS:
- If the blog post has an [Image URL] field, include the image FIRST: ![Title](image_url)
- If [Image URL] is empty or missing, skip the image
- Summarize the key points, do NOT quote the full blog text
- Include a link: [Read More](blog_url)

URLS:
- Any URL found in the source documents (blog URLs, video URLs, profile URLs, or any other link) MUST be included as a clickable markdown link in the response
- Use the format [descriptive text](url) so the user can click through to the original content
- Never omit a URL that appears in a source document you are referencing

Format all responses with clear markdown.` + userContext;
  }, [useRhwbSources, buildUserContext]);

  // Send message - wrapped in useCallback for stable reference
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
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      const modelName = process.env.REACT_APP_GEMINI_MODEL || 'gemini-2.0-flash-exp';
      const fileSearchStoreName = process.env.REACT_APP_FILE_SEARCH_STORE_NAME;

      if (!apiKey) throw new Error('Gemini API key not configured');

      // Build conversation history
      const conversationHistory = messages
        .filter((msg, index) => !(index === 0 && msg.role === 'assistant'))
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const fullPrompt = conversationHistory
        ? `${conversationHistory}\n\nUser: ${messageText}\n\nAssistant:`
        : messageText;

      // Build system instruction with priority instructions
      let systemInstruction = buildSystemInstruction();
      const priorityInstruction = getPriorityInstruction(messageText);
      if (priorityInstruction && useRhwbSources) {
        systemInstruction += `\n\nPriority instruction for this query: ${priorityInstruction}`;
      }

      const requestBody: any = {
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { maxOutputTokens: 2000, temperature: 0.7 }
      };

      // Add file search tool if enabled
      if (fileSearchStoreName && useRhwbSources) {
        const storeName = fileSearchStoreName.startsWith('fileSearchStores/')
          ? fileSearchStoreName
          : `fileSearchStores/${fileSearchStoreName}`;
        requestBody.tools = [{ file_search: { file_search_store_names: [storeName] } }];
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[VEER] API Error:', errorData);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) {
        console.error('[VEER] Empty or blocked response:', JSON.stringify(data));
        throw new Error('No response from Gemini');
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
  }, [messages, isLoading, useRhwbSources, buildSystemInstruction]);

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
      if (user?.email) {
        if (newType) {
          // Find the assistant message and the preceding user question
          const msgIndex = messages.findIndex(m => m.id === messageId);
          const assistantMessage = messages[msgIndex];
          let userQuestion = '';
          if (msgIndex > 0) {
            // Walk backwards to find the most recent user message before this assistant response
            for (let i = msgIndex - 1; i >= 0; i--) {
              if (messages[i].role === 'user') {
                userQuestion = messages[i].content;
                break;
              }
            }
          }

          const { error: upsertError } = await supabase.from('veer_feedback').upsert({
            message_id: messageId,
            username: user.email.toLowerCase(),
            feedback: newType,
            user_question: userQuestion || null,
            assistant_response: assistantMessage?.content || null,
            created_at: new Date().toISOString()
          }, { onConflict: 'message_id,username' });
          if (upsertError) {
            console.error('[VEER] Feedback upsert error:', upsertError.message, upsertError.details, upsertError.hint);
          }
        } else {
          await supabase.from('veer_feedback')
            .delete()
            .eq('message_id', messageId)
            .eq('username', user.email.toLowerCase());
        }
      }
    } catch (err) {
      console.error('[VEER] Error storing feedback:', err);
    }
  };

  // Save feedback comment
  const saveFeedbackComment = async (messageId: string) => {
    const comment = feedbackComment[messageId]?.trim();
    if (!comment || !user?.email) return;

    try {
      const { error: commentError } = await supabase.from('veer_feedback')
        .update({ comment })
        .eq('message_id', messageId)
        .eq('username', user.email.toLowerCase());

      if (commentError) {
        console.error('[VEER] Feedback comment error:', commentError.message);
      } else {
        setFeedbackCommentSaved(prev => ({ ...prev, [messageId]: true }));
        setTimeout(() => inputRef.current?.focus(), 100);
      }
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
