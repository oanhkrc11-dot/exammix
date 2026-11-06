// Hand-written types mirroring supabase/schema.sql. Regenerate with
// `supabase gen types typescript` once the project is linked, and replace
// this file if the generated shape drifts.

export type Role = "teacher" | "admin";

// NOTE: these must be `type` aliases, not `interface`s. Supabase's generic
// client resolves `Database['public']` against `GenericSchema` via a
// deferred conditional-type check; when Insert/Update are mapped types
// (`Partial<X>`/`Omit<X, ...>`) over an `interface`, TypeScript can't
// eagerly resolve that check and the whole schema silently collapses to
// `never` (every `.select()` result becomes untyped). Plain object type
// aliases don't have this problem.
export type Profile = {
  id: string;
  role: Role;
  display_name: string | null;
  gemini_api_key: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  user_id: string;
  subject: string;
  topic: string;
  type: string;
  content: string;
  answer: string;
  created_at: string;
};

export type ExamResult = {
  id: string;
  user_id: string;
  student_name: string;
  class_name: string;
  exam_code: string;
  correct: number;
  total: number;
  score: number;
  created_at: string;
};

export type ExamMixConfig = {
  id: string;
  user_id: string;
  name: string;
  config: Record<string, unknown>;
  created_at: string;
};

export type RoomStatus = "draft" | "open" | "closed";

export type ExamRoom = {
  id: string;
  user_id: string;
  name: string;
  join_code: string;
  status: RoomStatus;
  duration_minutes: number;
  scale: number;
  auto_submit: boolean;
  show_score_after_submit: boolean;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type ExamRoomVariant = {
  id: string;
  room_id: string;
  code: string;
  answer_key: string;
  created_at: string;
};

export type ParticipantStatus = "joined" | "submitted";

export type ExamRoomParticipant = {
  id: string;
  room_id: string;
  client_token: string;
  display_name: string;
  class_name: string;
  variant_code: string;
  status: ParticipantStatus;
  student_answers: string | null;
  correct: number | null;
  total: number | null;
  score: number | null;
  joined_at: string;
  submitted_at: string | null;
};

export type ClassRoom = {
  id: string;
  user_id: string;
  name: string;
  students: string[];
  created_at: string;
};

export type CustomLab = {
  id: string;
  user_id: string;
  kind: "lab" | "game";
  subject: string;
  grade: string;
  title: string;
  description: string;
  content_html: string | null;
  content_url: string | null;
  created_at: string;
};

type TableOf<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableOf<Profile, Partial<Profile> & { id: string }, Partial<Profile>>;
      questions: TableOf<
        Question,
        Omit<Question, "id" | "created_at"> & { id?: string },
        Partial<Omit<Question, "id" | "user_id">>
      >;
      exam_results: TableOf<
        ExamResult,
        Omit<ExamResult, "id" | "created_at"> & { id?: string },
        Partial<Omit<ExamResult, "id" | "user_id">>
      >;
      exam_mix_configs: TableOf<
        ExamMixConfig,
        Omit<ExamMixConfig, "id" | "created_at"> & { id?: string },
        Partial<Omit<ExamMixConfig, "id" | "user_id">>
      >;
      exam_rooms: TableOf<
        ExamRoom,
        Omit<ExamRoom, "id" | "created_at" | "join_code" | "status" | "started_at" | "ends_at"> &
          { id?: string; join_code: string; status?: RoomStatus; started_at?: string | null; ends_at?: string | null },
        Partial<Omit<ExamRoom, "id" | "user_id">>
      >;
      exam_room_variants: TableOf<
        ExamRoomVariant,
        Omit<ExamRoomVariant, "id" | "created_at"> & { id?: string },
        Partial<Omit<ExamRoomVariant, "id" | "room_id">>
      >;
      exam_room_participants: TableOf<
        ExamRoomParticipant,
        Omit<ExamRoomParticipant, "id" | "client_token" | "joined_at" | "status" | "student_answers" | "correct" | "total" | "score" | "submitted_at"> &
          { id?: string; client_token?: string; joined_at?: string },
        Partial<Omit<ExamRoomParticipant, "id" | "room_id">>
      >;
      classes: TableOf<
        ClassRoom,
        Omit<ClassRoom, "id" | "created_at"> & { id?: string },
        Partial<Omit<ClassRoom, "id" | "user_id">>
      >;
      custom_labs: TableOf<
        CustomLab,
        Omit<CustomLab, "id" | "created_at"> & { id?: string },
        Partial<Omit<CustomLab, "id" | "user_id">>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
