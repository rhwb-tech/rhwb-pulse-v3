import React from 'react';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  TextField,
  LinearProgress,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormGroup,
  useMediaQuery,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNpsSurvey } from '../hooks/useNpsSurvey';
import { supabase } from './supabaseClient';
import { NpsSurveyResponses } from '../types/survey';

const LITE_REASONS = [
  'I want to train independently without a coach',
  'I was looking for a cost-effective option',
  'I prefer running at my own pace',
  'I joined mainly for the community support rather than coaching',
];

const PULSE_EXPERIENCE_OPTIONS = [
  'I love Pulse as it motivates me to stay consistent',
  'I know about Pulse but rarely look at it',
  'I have seen Pulse but don\'t find it useful',
  'I was not aware of Pulse before this survey',
];

interface RatingQuestion {
  field: keyof NpsSurveyResponses;
  label: string;
  lowLabel: string;
  highLabel: string;
}

const COACH_QUESTIONS: RatingQuestion[] = [
  {
    field: 'feedback_quality',
    label: "Rate the quality and timeliness of your coach's feedback on Final Surge",
    lowLabel: 'Poor',
    highLabel: 'Excellent',
  },
  {
    field: 'communication',
    label: 'Rate the overall communication effectiveness of your coach with your cohort (WhatsApp, Zoom meetings, etc.)',
    lowLabel: 'Poor',
    highLabel: 'Excellent',
  },
  {
    field: 'relationship',
    label: 'Rate the relationship with your coach',
    lowLabel: 'Poor',
    highLabel: 'Excellent',
  },
];

const RHWB_QUESTIONS: RatingQuestion[] = [
  {
    field: 'rhwb_effectiveness',
    label: 'Rate the effectiveness of group communications',
    lowLabel: 'Poor',
    highLabel: 'Excellent',
  },
  {
    field: 'rhwb_knowledge_depth',
    label: 'Rate the depth and clarity of running knowledge shared',
    lowLabel: 'Poor',
    highLabel: 'Excellent',
  },
  {
    field: 'rhwb_recommendation',
    label: 'How likely are you to recommend RHWB to a friend or colleague?',
    lowLabel: 'Not at all likely',
    highLabel: 'Extremely likely',
  },
];

function RatingSelector({
  value,
  onChange,
  lowLabel,
  highLabel,
  isMobile,
}: {
  value: number | null;
  onChange: (val: number) => void;
  lowLabel: string;
  highLabel: string;
  isMobile: boolean;
}) {
  const buttonSize = isMobile ? 30 : 36;

  return (
    <Box sx={{ mb: 1 }}>
      <Box
        sx={{
          display: 'flex',
          gap: isMobile ? 0.25 : 0.5,
          justifyContent: 'center',
          flexWrap: 'nowrap',
        }}
      >
        {Array.from({ length: 11 }, (_, i) => (
          <Box
            key={i}
            onClick={() => onChange(i)}
            sx={{
              width: buttonSize,
              height: buttonSize,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: isMobile ? '0.7rem' : '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              ...(value === i
                ? {
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: '#fff',
                    transform: 'scale(1.15)',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
                  }
                : {
                    bgcolor: '#f0f0f0',
                    color: '#666',
                    '&:hover': {
                      bgcolor: '#e0e0e0',
                      transform: 'scale(1.05)',
                    },
                  }),
            }}
          >
            {i}
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 0.5,
          px: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
          {lowLabel}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
          {highLabel}
        </Typography>
      </Box>
    </Box>
  );
}

const NpsSurveyPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:600px)');
  const [showIntro, setShowIntro] = React.useState(true);
  const [currentSeason, setCurrentSeason] = React.useState('');

  // Fetch current season from rhwb_seasons
  React.useEffect(() => {
    const fetchCurrentSeason = async () => {
      const { data } = await supabase
        .from('rhwb_seasons')
        .select('season')
        .eq('current', true)
        .single();
      const seasonStr = data?.season || 'Season 15';
      const match = seasonStr.match(/Season\s+(\d+)/i);
      setCurrentSeason(match ? match[1] : '15');
    };
    fetchCurrentSeason();
  }, []);

  const email = user?.email || '';
  const userRole = user?.role;

  const survey = useNpsSurvey(email, userRole, currentSeason);

  const {
    step,
    setStep,
    responses,
    metadata,
    submitting,
    checkComplete,
    updateResponse,
    nextStep,
    prevStep,
    submit,
    dismiss,
  } = survey;

  const isLiteRunner = metadata?.is_lite_runner ?? false;

  // Total survey steps: non-Lite has 5 (0-4), Lite has 3 (0,2,4 — steps 1,3 skipped)
  const totalSteps = isLiteRunner ? 3 : 5;
  const effectiveStep = isLiteRunner ? (step === 0 ? 0 : step === 2 ? 1 : 2) : step;
  const progress = showIntro ? 0 : ((effectiveStep + 1) / totalSteps) * 100;

  // Check if any of the 4 coach ratings is 6 or less
  const hasLowCoachRating = [
    responses.feedback_quality,
    responses.communication,
    responses.relationship,
    responses.recommendation,
  ].some((r) => r !== null && r <= 6);

  // Check if Lite rating is 6 or less
  const hasLowLiteRating = responses.lite_rating !== null && responses.lite_rating <= 6;

  // Check if any RHWB rating is 6 or less
  const hasLowRhwbRating = [
    responses.rhwb_effectiveness,
    responses.rhwb_knowledge_depth,
    responses.rhwb_recommendation,
  ].some((r) => r !== null && r <= 6);

  const isStepValid = () => {
    if (step === 0) {
      if (isLiteRunner) {
        if (responses.lite_reasons.length === 0) return false;
        if (responses.lite_rating === null) return false;
        if (hasLowLiteRating && !responses.lite_comments.trim()) return false;
        return true;
      }
      const ratingsComplete =
        responses.feedback_quality !== null &&
        responses.communication !== null &&
        responses.relationship !== null;
      if (!ratingsComplete) return false;
      return true;
    }
    if (step === 1) {
      if (responses.recommendation === null) return false;
      if (hasLowCoachRating && !responses.comments.trim()) return false;
      return true;
    }
    if (step === 2) {
      const ratingsComplete =
        responses.rhwb_effectiveness !== null &&
        responses.rhwb_knowledge_depth !== null &&
        responses.rhwb_recommendation !== null;
      if (!ratingsComplete) return false;
      if (hasLowRhwbRating && !responses.rhwb_comments.trim()) return false;
      return true;
    }
    if (step === 3) {
      if (!responses.pulse_experience) return false;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 3 || (step === 2 && isLiteRunner)) {
      // Submit: step 3 for non-Lite, step 2 for Lite (Pulse question hidden)
      submit();
    } else if (step === 0 && isLiteRunner) {
      // Lite runners skip step 1 (coach recommendation) — go straight to RHWB
      setStep(2);
    } else {
      nextStep();
    }
  };

  const handleBack = () => {
    if (step === 2 && isLiteRunner) {
      // Lite runners skip step 1 — go back to step 0
      setStep(0);
    } else {
      prevStep();
    }
  };

  const goToDashboard = () => {
    navigate('/');
  };

  // Show loading while checking eligibility
  if (!checkComplete) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>Loading survey...</Typography>
      </Box>
    );
  }

  // If already submitted or not eligible, redirect to dashboard
  if (checkComplete && !survey.shouldShowSurvey && step !== 4) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', gap: 2 }}>
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
          Survey already completed or not available
        </Typography>
        <Button variant="contained" onClick={goToDashboard}
          sx={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' } }}
        >
          Go to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        py: { xs: 2, sm: 4 },
        px: { xs: 1, sm: 2 },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {/* Progress bar */}
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 4,
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
              },
              bgcolor: '#f0f0f0',
            }}
          />

          {/* Intro page */}
          {showIntro && (
            <>
              <Box sx={{ px: 3, pt: 4, pb: 2 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', sm: '1.4rem' },
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1,
                  }}
                >
                  Season {currentSeason} Feedback Survey
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, mb: 2, fontSize: { xs: '1rem', sm: '1.15rem' } }}
                >
                  Your Feedback is a Gift.
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
                  For over 15 seasons, RHWB has grown by continuously listening to our runners. Your honest feedback—both positive and developmental—helps us improve and strengthen our coaching program.
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
                  This survey will take <strong>less than 4 minutes</strong>, but your input can make a meaningful difference for hundreds of runners in future seasons.
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 2 }}>
                  Your <strong>responses are anonymous</strong> to your coach. Your email is used only to authenticate responses and prevent duplicate submissions.
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 3, fontWeight: 500 }}>
                  Thank you for helping us get better.
                </Typography>
              </Box>
              <Box sx={{ px: 3, pb: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={() => { dismiss(); goToDashboard(); }} color="inherit" size="small">
                  Maybe Later
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setShowIntro(false)}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' },
                  }}
                >
                  Start Survey
                </Button>
              </Box>
            </>
          )}

          {/* Header */}
          {!showIntro && (
          <Box sx={{ px: 3, pt: 3, pb: 1 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.1rem', sm: '1.4rem' },
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {step === 0 && (isLiteRunner ? 'Overall Feedback: Self Serve Program' : 'Detailed Feedback: Your Coach')}
              {step === 1 && 'Overall Feedback: Your Coach'}
              {step === 2 && 'Detailed Feedback: RHWB Organization'}
              {step === 3 && <>Feedback on Pulse: Our Runner Metrics Dashboard (<a href="https://pulse.rhwb.org" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>pulse.rhwb.org</a>)</>}
              {step === 4 && 'Thank You!'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Season {currentSeason} Feedback Survey
            </Typography>
          </Box>
          )}

          {/* Content */}
          {!showIntro && (<>
          <Box sx={{ px: 3, py: 2 }}>
            {/* Step 0: Coach ratings (3 questions) */}
            {step === 0 && !isLiteRunner && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Help us improve by sharing your experience with your coach this season.
                </Typography>
                {COACH_QUESTIONS.map((q) => (
                  <Box key={q.field} sx={{ mb: 2.5 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      {q.label}
                    </Typography>
                    <RatingSelector
                      value={responses[q.field] as number | null}
                      onChange={(val) => updateResponse(q.field, val)}
                      lowLabel={q.lowLabel}
                      highLabel={q.highLabel}
                      isMobile={isMobile}
                    />
                  </Box>
                ))}
              </Box>
            )}

            {/* Step 1: Coach recommendation + comments */}
            {step === 1 && (
              <Box>
                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                  >
                    How likely are you to recommend your coach to a friend or colleague?
                  </Typography>
                  <RatingSelector
                    value={responses.recommendation}
                    onChange={(val) => updateResponse('recommendation', val)}
                    lowLabel="Not at all likely"
                    highLabel="Extremely likely"
                    isMobile={isMobile}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1 }}>
                  We value any qualitative feedback that helps provide context to your ratings.
                  {hasLowCoachRating && ' If you have given a rating of 6 or below, we especially encourage you to share your observations so we can better understand and improve.'}
                </Typography>
                <TextField
                  label={hasLowCoachRating ? 'Your feedback (required)' : 'Additional comments (optional)'}
                  required={hasLowCoachRating}
                  error={hasLowCoachRating && !responses.comments.trim()}
                  helperText=""
                  multiline
                  minRows={2}
                  maxRows={4}
                  fullWidth
                  value={responses.comments}
                  onChange={(e) => updateResponse('comments', e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            {/* Step 0 (Lite): Lite program questions */}
            {step === 0 && isLiteRunner && (
              <Box>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  I chose the Lite program because (select all that apply):
                </Typography>
                <FormGroup sx={{ mb: 2.5, pl: 1 }}>
                  {LITE_REASONS.map((reason) => (
                    <FormControlLabel
                      key={reason}
                      control={
                        <Checkbox
                          checked={responses.lite_reasons.includes(reason)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...responses.lite_reasons, reason]
                              : responses.lite_reasons.filter((r) => r !== reason);
                            updateResponse('lite_reasons', updated);
                          }}
                          size="small"
                          sx={{ '&.Mui-checked': { color: '#764ba2' } }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          {reason}
                        </Typography>
                      }
                    />
                  ))}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={responses.lite_reasons.some((r) => r.startsWith('Other:') || r === 'Other')}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...responses.lite_reasons.filter((r) => !r.startsWith('Other')), 'Other']
                            : responses.lite_reasons.filter((r) => !r.startsWith('Other'));
                          updateResponse('lite_reasons', updated);
                        }}
                        size="small"
                        sx={{ '&.Mui-checked': { color: '#764ba2' } }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                        Other
                      </Typography>
                    }
                  />
                  {responses.lite_reasons.some((r) => r.startsWith('Other')) && (
                    <TextField
                      placeholder="Please specify"
                      size="small"
                      variant="outlined"
                      fullWidth
                      value={
                        responses.lite_reasons.find((r) => r.startsWith('Other:'))?.replace('Other: ', '') || ''
                      }
                      onChange={(e) => {
                        const otherValue = e.target.value ? `Other: ${e.target.value}` : 'Other';
                        const updated = [
                          ...responses.lite_reasons.filter((r) => !r.startsWith('Other')),
                          otherValue,
                        ];
                        updateResponse('lite_reasons', updated);
                      }}
                      sx={{ ml: 4, mt: 0.5, maxWidth: 300 }}
                    />
                  )}
                </FormGroup>

                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                  >
                    Rate RHWB's Lite Program
                  </Typography>
                  <RatingSelector
                    value={responses.lite_rating}
                    onChange={(val) => updateResponse('lite_rating', val)}
                    lowLabel="Poor"
                    highLabel="Excellent"
                    isMobile={isMobile}
                  />
                </Box>

                <TextField
                  label={hasLowLiteRating ? 'Let us know how we can improve the Lite Program (required)' : 'Let us know how we can improve the Lite Program (optional)'}
                  required={hasLowLiteRating}
                  error={hasLowLiteRating && !responses.lite_comments.trim()}
                  helperText=""
                  multiline
                  minRows={2}
                  maxRows={4}
                  fullWidth
                  value={responses.lite_comments}
                  onChange={(e) => updateResponse('lite_comments', e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            {/* Step 2: RHWB ratings */}
            {step === 2 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Now share your thoughts on the RHWB program overall.
                </Typography>
                {RHWB_QUESTIONS.map((q) => (
                  <Box key={q.field} sx={{ mb: 2.5 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                    >
                      {q.label}
                    </Typography>
                    <RatingSelector
                      value={responses[q.field] as number | null}
                      onChange={(val) => updateResponse(q.field, val)}
                      lowLabel={q.lowLabel}
                      highLabel={q.highLabel}
                      isMobile={isMobile}
                    />
                  </Box>
                ))}
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1 }}>
                  We value any qualitative feedback that helps provide context to your ratings.
                  {hasLowRhwbRating && ' If you have given a rating of 6 or below, we especially encourage you to share your observations so we can better understand and improve.'}
                </Typography>
                <TextField
                  label={hasLowRhwbRating ? 'Your feedback (required)' : 'Additional comments (optional)'}
                  required={hasLowRhwbRating}
                  error={hasLowRhwbRating && !responses.rhwb_comments.trim()}
                  helperText=""
                  multiline
                  minRows={2}
                  maxRows={4}
                  fullWidth
                  value={responses.rhwb_comments}
                  onChange={(e) => updateResponse('rhwb_comments', e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            {/* Step 3: Pulse experience (non-Lite only) */}
            {step === 3 && (
              <Box>
                <Box sx={{ mb: 2.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                  >
                    What best describes your experience with Pulse, the dashboard that tracks runner consistency and commitment?
                  </Typography>
                  <RadioGroup
                    value={responses.pulse_experience}
                    onChange={(e) => updateResponse('pulse_experience', e.target.value)}
                  >
                    {PULSE_EXPERIENCE_OPTIONS.map((option) => (
                      <FormControlLabel
                        key={option}
                        value={option}
                        control={
                          <Radio
                            size="small"
                            sx={{ '&.Mui-checked': { color: '#764ba2' } }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                            {option}
                          </Typography>
                        }
                      />
                    ))}
                  </RadioGroup>
                </Box>
              </Box>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <CheckCircleOutlineIcon
                  sx={{
                    fontSize: 64,
                    color: '#4caf50',
                    mb: 2,
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Your feedback has been submitted
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {isLiteRunner
                    ? 'Thank you for helping us improve the RHWB experience. The survey is now complete — you may exit by closing the browser.'
                    : 'Thank you for helping us improve the RHWB experience. Your responses are confidential and will be used to enhance our coaching and program.'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Actions */}
          <Box sx={{ px: 3, pb: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {step === 0 && (
              <>
                <Button onClick={() => { dismiss(); goToDashboard(); }} color="inherit" size="small">
                  Maybe Later
                </Button>
                <Button
                  onClick={handleNext}
                  variant="contained"
                  disabled={!isStepValid()}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' },
                    '&.Mui-disabled': { background: '#e0e0e0' },
                  }}
                >
                  Next
                </Button>
              </>
            )}
            {step === 1 && (
              <>
                <Button onClick={handleBack} color="inherit" size="small">
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  variant="contained"
                  disabled={!isStepValid()}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' },
                    '&.Mui-disabled': { background: '#e0e0e0' },
                  }}
                >
                  Next
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button onClick={handleBack} color="inherit" size="small">
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  variant="contained"
                  disabled={!isStepValid() || (isLiteRunner && submitting)}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' },
                    '&.Mui-disabled': { background: '#e0e0e0' },
                  }}
                >
                  {isLiteRunner ? (submitting ? 'Submitting...' : 'Submit') : 'Next'}
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button onClick={handleBack} color="inherit" size="small">
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  variant="contained"
                  disabled={!isStepValid() || submitting}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' },
                    '&.Mui-disabled': { background: '#e0e0e0' },
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </Button>
              </>
            )}
            {step === 4 && !isLiteRunner && (
              <Button
                onClick={goToDashboard}
                variant="contained"
                sx={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' },
                }}
              >
                Go to Dashboard
              </Button>
            )}
          </Box>
          </>)}
        </Paper>
      </Container>
    </Box>
  );
};

export default NpsSurveyPage;
