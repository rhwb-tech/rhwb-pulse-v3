import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  LinearProgress,
  IconButton,
  Checkbox,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormGroup,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { NpsSurveyResponses } from '../types/survey';

const LITE_REASONS = [
  'I want to train independently without a coach',
  'I was looking for a cost-effective option',
  'I prefer running at my own pace without accountability',
  'I joined mainly for the community support rather than coaching',
  'I have my own coach outside RHWB',
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
  {
    field: 'recommendation',
    label: 'How likely are you to recommend your coach to a friend or colleague?',
    lowLabel: 'Not at all likely',
    highLabel: 'Extremely likely',
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

interface NpsSurveyDialogProps {
  open: boolean;
  step: number;
  responses: NpsSurveyResponses;
  submitting: boolean;
  coachName: string | null;
  isLiteRunner: boolean;
  updateResponse: (field: keyof NpsSurveyResponses, value: number | string | string[] | null) => void;
  nextStep: () => void;
  prevStep: () => void;
  dismiss: () => void;
  submit: () => void;
  close: () => void;
}

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

const NpsSurveyDialog: React.FC<NpsSurveyDialogProps> = ({
  open,
  step,
  responses,
  submitting,
  coachName,
  isLiteRunner,
  updateResponse,
  nextStep,
  prevStep,
  dismiss,
  submit,
  close,
}) => {
  const isMobile = useMediaQuery('(max-width:600px)');
  const progress = ((step + 1) / 3) * 100;

  // Check if any coach rating is 6 or less
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

  // Check if current step has all required fields filled
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
        responses.relationship !== null &&
        responses.recommendation !== null;
      if (!ratingsComplete) return false;
      if (hasLowCoachRating && !responses.comments.trim()) return false;
      return true;
    }
    if (step === 1) {
      const ratingsComplete =
        responses.rhwb_effectiveness !== null &&
        responses.rhwb_knowledge_depth !== null &&
        responses.rhwb_recommendation !== null;
      if (!ratingsComplete) return false;
      if (!responses.pulse_experience) return false;
      if (hasLowRhwbRating && !responses.rhwb_comments.trim()) return false;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      submit();
    } else {
      nextStep();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={step === 2 ? close : dismiss}
      fullScreen={isMobile}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
        },
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

      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 0,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1rem', sm: '1.2rem' },
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {step === 0 && (isLiteRunner ? 'Rate the Lite Program' : coachName ? `Rate Your Coach - ${coachName}` : 'Rate Your Coach')}
          {step === 1 && 'Rate RHWB'}
          {step === 2 && 'Thank You!'}
        </Typography>
        <IconButton onClick={step === 2 ? close : dismiss} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Step 0: Coach ratings OR Lite program questions */}
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
            <TextField
              label={hasLowCoachRating ? 'Please share what we can improve (required)' : 'Additional comments (optional)'}
              required={hasLowCoachRating}
              error={hasLowCoachRating && !responses.comments.trim()}
              helperText={hasLowCoachRating && !responses.comments.trim() ? 'Comments are required when a rating is 6 or below' : ''}
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
                      sx={{
                        '&.Mui-checked': {
                          color: '#764ba2',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                      {reason}
                    </Typography>
                  }
                />
              ))}
              {/* Other option with text input */}
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
                    sx={{
                      '&.Mui-checked': {
                        color: '#764ba2',
                      },
                    }}
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
              helperText={hasLowLiteRating && !responses.lite_comments.trim() ? 'Comments are required when a rating is 6 or below' : ''}
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

        {/* Step 1: RHWB ratings */}
        {step === 1 && (
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

            <TextField
              label={hasLowRhwbRating ? 'Please share what we can improve (required)' : 'Additional comments (optional)'}
              required={hasLowRhwbRating}
              error={hasLowRhwbRating && !responses.rhwb_comments.trim()}
              helperText={hasLowRhwbRating && !responses.rhwb_comments.trim() ? 'Comments are required when a rating is 6 or below' : ''}
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

        {/* Step 2: Confirmation */}
        {step === 2 && (
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
              Thank you for helping us improve the RHWB experience. Your responses are confidential and will be used to enhance our coaching and program.
            </Typography>
          </Box>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {step === 0 && (
          <>
            <Button onClick={dismiss} color="inherit" size="small">
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
            <Button onClick={prevStep} color="inherit" size="small">
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
        {step === 2 && (
          <Button
            onClick={close}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              '&:hover': { background: 'linear-gradient(135deg, #5a6fd6, #6a4295)' },
            }}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default NpsSurveyDialog;
