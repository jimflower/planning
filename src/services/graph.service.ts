/**
 * Microsoft Graph service.
 * Sends planning emails via Graph API using MSAL access tokens.
 */
import { authService } from './auth.service';

interface GraphRecipient {
  emailAddress: { name?: string; address: string };
}

export const graphService = {
  /**
   * Send an email via Microsoft Graph POST /me/sendMail
   */
  async sendPlanningEmail(
    subject: string,
    htmlBody: string,
    toRecipients: string[],
    ccRecipients: string[] = [],
  ): Promise<{ success: boolean; error?: string }> {
    const token = await authService.getGraphToken();

    const toList: GraphRecipient[] = toRecipients.map((addr) => ({
      emailAddress: { address: addr.trim() },
    }));
    const ccList: GraphRecipient[] = ccRecipients.map((addr) => ({
      emailAddress: { address: addr.trim() },
    }));

    const payload = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: htmlBody,
        },
        toRecipients: toList,
        ...(ccList.length > 0 ? { ccRecipients: ccList } : {}),
      },
      saveToSentItems: true,
    };

    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 202 || res.ok) {
      return { success: true };
    }

    const errBody = await res.text();
    console.error('[Graph] sendMail failed:', res.status, errBody);
    return {
      success: false,
      error: `Failed to send email (${res.status}): ${errBody}`,
    };
  },
};
