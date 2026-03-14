import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../components/supabaseClient';
import { NpsSurveyResponses, NpsSurveyMetadata } from '../types/survey';

const INITIAL_RESPONSES: NpsSurveyResponses = {
  feedback_quality: null,
  communication: null,
  relationship: null,
  recommendation: null,
  comments: '',
  rhwb_effectiveness: null,
  rhwb_knowledge_depth: null,
  rhwb_recommendation: null,
  rhwb_comments: '',
  lite_reasons: [],
  lite_rating: null,
  lite_comments: '',
  pulse_experience: '',
};

export function useNpsSurvey(email: string, userRole: string | undefined, season: string) {
  const [shouldShowSurvey, setShouldShowSurvey] = useState(false);
  const [step, setStep] = useState(0); // 0: Coach ratings, 1: Coach recommendation, 2: RHWB, 3: Pulse experience, 4: Confirmation
  const [responses, setResponses] = useState<NpsSurveyResponses>(INITIAL_RESPONSES);
  const [metadata, setMetadata] = useState<NpsSurveyMetadata | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkComplete, setCheckComplete] = useState(false);

  const seasonKey = `Season ${season}`;
  const dismissedKey = `rhwb-nps-dismissed-${seasonKey}`;

  // Check eligibility on mount
  useEffect(() => {
    if (!email || !season || !userRole) return;
    if (userRole !== 'runner' && userRole !== 'athlete' && userRole !== 'hybrid') {
      setCheckComplete(true);
      return;
    }

    // Check session dismissal
    try {
      if (sessionStorage.getItem(dismissedKey) === 'true') {
        setCheckComplete(true);
        return;
      }
    } catch { /* sessionStorage unavailable */ }

    const checkEligibility = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/nps-survey`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'check', season: seasonKey }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('[NPS] Check failed:', response.status);
          return;
        }

        const result = await response.json();
        console.log('[NPS] Check result:', result);

        if (result.metadata) {
          setMetadata(result.metadata);
        }
        if (result.hasMeso3) {
          setShouldShowSurvey(true);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error('[NPS] Check timed out');
        } else {
          console.error('[NPS] Check error:', err);
        }
      } finally {
        setCheckComplete(true);
      }
    };

    checkEligibility();
  }, [email, season, userRole, seasonKey, dismissedKey]);

  const updateResponse = useCallback((field: keyof NpsSurveyResponses, value: number | string | string[] | null) => {
    setResponses(prev => ({ ...prev, [field]: value }));
  }, []);

  const nextStep = useCallback(() => {
    setStep(prev => Math.min(prev + 1, 4));
  }, []);

  const prevStep = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 0));
  }, []);

  const dismiss = useCallback(() => {
    setShouldShowSurvey(false);
    try {
      sessionStorage.setItem(dismissedKey, 'true');
    } catch { /* sessionStorage unavailable */ }
  }, [dismissedKey]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[NPS] No session for submit');
        setSubmitting(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/nps-survey`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'submit',
            season: seasonKey,
            responses,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('[NPS] Submit failed:', response.status);
        setSubmitting(false);
        return;
      }

      const result = await response.json();
      console.log('[NPS] Submit result:', result);

      if (result.success) {
        setStep(4); // Show confirmation
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error('[NPS] Submit timed out');
      } else {
        console.error('[NPS] Submit error:', err);
      }
    } finally {
      setSubmitting(false);
    }
  }, [responses, seasonKey]);

  const close = useCallback(() => {
    setShouldShowSurvey(false);
  }, []);

  return {
    shouldShowSurvey,
    step,
    setStep,
    responses,
    metadata,
    submitting,
    checkComplete,
    updateResponse,
    nextStep,
    prevStep,
    dismiss,
    submit,
    close,
  };
}
