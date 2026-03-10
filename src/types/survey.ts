export interface NpsSurveyResponses {
  feedback_quality: number | null;
  communication: number | null;
  relationship: number | null;
  recommendation: number | null;
  comments: string;
  rhwb_effectiveness: number | null;
  rhwb_knowledge_depth: number | null;
  rhwb_recommendation: number | null;
  rhwb_comments: string;
  // Lite runner fields
  lite_reasons: string[];
  lite_rating: number | null;
  lite_comments: string;
  // Pulse experience (RHWB step)
  pulse_experience: string;
}

export interface NpsSurveyMetadata {
  program: string | null;
  are_you_a_new_or_return_runner_to_rhwb: string | null;
  race_type: string | null;
  coach_email: string | null;
  coach_name: string | null;
  is_lite_runner: boolean;
}

export interface NpsSurveyCheckResult {
  hasMeso3: boolean;
  alreadySubmitted: boolean;
  metadata: NpsSurveyMetadata;
}
