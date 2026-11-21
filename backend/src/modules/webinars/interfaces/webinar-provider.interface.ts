export interface CreateSessionInput {
  webinarId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  hostEmail: string;
  hostName?: string;
}

export interface UpdateSessionInput {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  timezone?: string;
}

export interface ProviderSessionResult {
  providerSessionId: string;
  meetingLink: string;
  hostJoinUrl?: string;
  passcode?: string;
  providerMetadata: Record<string, any>;
}

export interface WebinarProvider {
  readonly providerName: string;

  /**
   * Create conference meeting session with the provider.
   */
  createSession(input: CreateSessionInput): Promise<ProviderSessionResult>;

  /**
   * Update conference session schedule or metadata.
   */
  updateSession(sessionId: string, input: UpdateSessionInput): Promise<ProviderSessionResult>;

  /**
   * Cancel conference session with the provider.
   */
  cancelSession(sessionId: string, reason?: string): Promise<void>;

  /**
   * Optionally add an attendee to the provider session (e.g. Google Calendar attendee dispatch).
   * Providers that issue personal join links (Zoom registrants) return an AttendeeResult.
   */
  addAttendee?(
    sessionId: string,
    attendee: { email: string; displayName?: string },
  ): Promise<boolean | AttendeeResult>;

  /**
   * Optionally revoke an attendee's access (their personal join link stops working).
   */
  removeAttendee?(sessionId: string, attendee: { registrantId: string; email: string }): Promise<boolean>;

  /**
   * Optionally lock an existing session down so only approved registrants can join
   * (used to upgrade meetings created before registration enforcement existed).
   */
  enforceRegistrationSettings?(sessionId: string): Promise<void>;
}

export interface AttendeeResult {
  ok: boolean;
  /** Provider's own registrant ID. */
  registrantId?: string;
  /** Personal join URL valid only for this registrant. */
  joinUrl?: string;
  error?: string;
}

