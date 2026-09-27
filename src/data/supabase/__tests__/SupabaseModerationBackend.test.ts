import { DuplicateReportError } from '../../community/ModerationBackend';
import { ReportRateLimitedError, ReportTargetUnavailableError, supabaseModerationBackend } from '../SupabaseModerationBackend';

const mockInsert = jest.fn();
jest.mock('../client', () => ({
  get supabase() {
    return { from: () => ({ insert: (...a: unknown[]) => mockInsert(...a) }) };
  },
}));

const mockReportError = jest.fn();
jest.mock('../../../lib/crashReporting', () => ({ reportError: (...a: unknown[]) => mockReportError(...a) }));

const REPORTER = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const file = () => supabaseModerationBackend.reportContent(REPORTER, 'recipe', TARGET, 'spam', '  details  ');

beforeEach(() => {
  mockInsert.mockReset();
  mockReportError.mockReset();
});

describe('reportContent', () => {
  it('inserts the report (status/created_at are left to the server)', async () => {
    mockInsert.mockResolvedValue({ error: null });
    await file();
    expect(mockInsert).toHaveBeenCalledWith({ reporter_id: REPORTER, target_type: 'recipe', target_id: TARGET, reason: 'spam', details: 'details' });
    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('status');
    expect(row).not.toHaveProperty('created_at');
  });

  it('maps the open-report unique violation to DuplicateReportError', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    await expect(file()).rejects.toBeInstanceOf(DuplicateReportError);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('maps the trigger\'s missing-target error (23503 + hint) to ReportTargetUnavailableError without crash-reporting', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23503', message: 'report target not found', hint: 'report_target_not_found', details: null } });
    await expect(file()).rejects.toBeInstanceOf(ReportTargetUnavailableError);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('maps the rate limit (54000) to ReportRateLimitedError without crash-reporting', async () => {
    mockInsert.mockResolvedValue({ error: { code: '54000', message: 'report rate limit exceeded', hint: 'report_rate_limited' } });
    await expect(file()).rejects.toBeInstanceOf(ReportRateLimitedError);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('still reports and rethrows any other error, including an unrelated FK violation', async () => {
    const fk = { code: '23503', message: 'insert or update on table "reports" violates foreign key constraint "reports_reporter_id_fkey"', hint: null };
    mockInsert.mockResolvedValue({ error: fk });
    await expect(file()).rejects.toBe(fk);
    expect(mockReportError).toHaveBeenCalledTimes(1);

    const net = { message: 'network down' };
    mockInsert.mockResolvedValue({ error: net });
    await expect(file()).rejects.toBe(net);
    expect(mockReportError).toHaveBeenCalledTimes(2);
  });
});
