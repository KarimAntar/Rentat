import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, collections } from '../config/firebase';

export type ReportType = 'item' | 'user' | 'chat' | 'review';
export type ReportReason = 
  | 'spam'
  | 'inappropriate_content'
  | 'scam'
  | 'harassment'
  | 'fake_listing'
  | 'dangerous_item'
  | 'other';

export interface Report {
  id?: string;
  type: ReportType;
  reportedBy: string;
  reportedAgainst: string; // User ID or Item ID
  targetId: string; // The ID of the specific thing being reported
  reason: ReportReason;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: string;
  metadata?: {
    itemTitle?: string;
    userName?: string;
    chatId?: string;
    reviewId?: string;
    screenshots?: string[];
  };
}

export interface Dispute {
  id?: string;
  rentalId: string;
  type: 'damage' | 'late_return' | 'not_as_described' | 'payment' | 'other';
  initiatedBy: string; // User ID (owner or renter)
  respondent: string; // The other party
  status: 'open' | 'in_review' | 'resolved' | 'escalated';
  priority: 'low' | 'medium' | 'high';
  description: string;
  evidence: {
    photos?: string[];
    messages?: string[];
    documents?: string[];
  };
  timeline: Array<{
    timestamp: Date;
    action: string;
    userId: string;
    note?: string;
  }>;
  resolution?: {
    decision: string;
    refundAmount?: number;
    penaltyAmount?: number;
    resolvedBy: string;
    resolvedAt: Date;
    notes: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

export class ModerationService {
  // Submit a report
  async submitReport(report: Omit<Report, 'id' | 'createdAt' | 'status'>): Promise<string> {
    try {
      const reportData = {
        ...report,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'moderation_queue'), reportData);
      
      // Create notification for admins
      await this.notifyAdmins('new_report', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('Error submitting report:', error);
      throw new Error('Failed to submit report');
    }
  }

  // Report an item
  async reportItem(
    itemId: string,
    reportedBy: string,
    reason: ReportReason,
    description: string
  ): Promise<string> {
    try {
      // Get item details
      const itemDoc = await getDoc(doc(db, collections.items, itemId));
      const itemData = itemDoc.data();

      if (!itemData) {
        throw new Error('Item not found');
      }

      // Get owner details
      let ownerName = 'Unknown User';
      if (itemData.ownerId) {
        try {
          const ownerDoc = await getDoc(doc(db, collections.users, itemData.ownerId));
          const ownerData = ownerDoc.data();
          ownerName = ownerData?.displayName || ownerData?.email || 'Unknown User';
        } catch (ownerError) {
          console.warn('Could not fetch owner details:', ownerError);
        }
      }

      const report: Omit<Report, 'id' | 'createdAt' | 'status'> = {
        type: 'item',
        reportedBy,
        reportedAgainst: itemData.ownerId || '',
        targetId: itemId,
        reason,
        description,
        priority: this.calculatePriority(reason),
        metadata: {
          itemTitle: itemData.title,
          userName: ownerName,
        },
      };

      return await this.submitReport(report);
    } catch (error) {
      console.error('Error reporting item:', error);
      throw new Error('Failed to report item');
    }
  }

  // Report a user
  async reportUser(
    userId: string,
    reportedBy: string,
    reason: ReportReason,
    description: string
  ): Promise<string> {
    try {
      // Get user details
      const userDoc = await getDoc(doc(db, collections.users, userId));
      const userData = userDoc.data();

      const report: Omit<Report, 'id' | 'createdAt' | 'status'> = {
        type: 'user',
        reportedBy,
        reportedAgainst: userId,
        targetId: userId,
        reason,
        description,
        priority: this.calculatePriority(reason),
        metadata: {
          userName: userData?.displayName || userData?.email,
        },
      };

      return await this.submitReport(report);
    } catch (error) {
      console.error('Error reporting user:', error);
      throw new Error('Failed to report user');
    }
  }

  // Report a chat message
  async reportChat(
    chatId: string,
    messageId: string,
    reportedBy: string,
    reportedAgainst: string,
    reason: ReportReason,
    description: string
  ): Promise<string> {
    try {
      const report: Omit<Report, 'id' | 'createdAt' | 'status'> = {
        type: 'chat',
        reportedBy,
        reportedAgainst,
        targetId: messageId,
        reason,
        description,
        priority: this.calculatePriority(reason),
        metadata: {
          chatId,
        },
      };

      return await this.submitReport(report);
    } catch (error) {
      console.error('Error reporting chat:', error);
      throw new Error('Failed to report chat');
    }
  }

  // Create a dispute
  async createDispute(dispute: Omit<Dispute, 'id' | 'createdAt' | 'status' | 'timeline'>): Promise<string> {
    try {
      const disputeData: Omit<Dispute, 'id'> = {
        ...dispute,
        status: 'open',
        createdAt: serverTimestamp() as any,
        timeline: [
          {
            timestamp: new Date(),
            action: 'dispute_created',
            userId: dispute.initiatedBy,
            note: 'Dispute opened',
          },
        ],
      };

      const docRef = await addDoc(collection(db, 'disputes'), disputeData);

      // Notify both parties
      await this.notifyDisputeParties(docRef.id, dispute.initiatedBy, dispute.respondent);

      // Notify admins
      await this.notifyAdmins('new_dispute', docRef.id);

      return docRef.id;
    } catch (error) {
      console.error('Error creating dispute:', error);
      throw new Error('Failed to create dispute');
    }
  }

  // Get user's reports
  async getUserReports(userId: string): Promise<Report[]> {
    try {
      const q = query(
        collection(db, 'moderation_queue'),
        where('reportedBy', '==', userId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Report));
    } catch (error) {
      console.error('Error getting user reports:', error);
      return [];
    }
  }

  // Get user's disputes
  async getUserDisputes(userId: string): Promise<Dispute[]> {
    try {
      const q = query(
        collection(db, 'disputes'),
        where('initiatedBy', '==', userId)
      );

      const snapshot = await getDocs(q);
      const disputes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Dispute));

      // Also get disputes where user is the respondent
      const q2 = query(
        collection(db, 'disputes'),
        where('respondent', '==', userId)
      );

      const snapshot2 = await getDocs(q2);
      const disputes2 = snapshot2.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Dispute));

      return [...disputes, ...disputes2];
    } catch (error) {
      console.error('Error getting user disputes:', error);
      return [];
    }
  }

  // Add response to dispute
  async addDisputeResponse(
    disputeId: string,
    userId: string,
    response: string,
    evidence?: { photos?: string[]; documents?: string[] }
  ): Promise<void> {
    try {
      const disputeRef = doc(db, 'disputes', disputeId);
      const disputeDoc = await getDoc(disputeRef);
      
      if (!disputeDoc.exists()) {
        throw new Error('Dispute not found');
      }

      const dispute = disputeDoc.data() as Dispute;
      const timeline = dispute.timeline || [];

      timeline.push({
        timestamp: new Date(),
        action: 'response_added',
        userId,
        note: response,
      });

      const updateData: any = {
        timeline,
        updatedAt: serverTimestamp(),
      };

      if (evidence) {
        if (evidence.photos) {
          updateData['evidence.photos'] = [
            ...(dispute.evidence?.photos || []),
            ...evidence.photos,
          ];
        }
        if (evidence.documents) {
          updateData['evidence.documents'] = [
            ...(dispute.evidence?.documents || []),
            ...evidence.documents,
          ];
        }
      }

      await updateDoc(disputeRef, updateData);
    } catch (error) {
      console.error('Error adding dispute response:', error);
      throw new Error('Failed to add dispute response');
    }
  }

  // Calculate priority based on reason
  private calculatePriority(reason: ReportReason): Report['priority'] {
    switch (reason) {
      case 'scam':
      case 'dangerous_item':
        return 'urgent';
      case 'harassment':
      case 'fake_listing':
        return 'high';
      case 'inappropriate_content':
        return 'medium';
      default:
        return 'low';
    }
  }

  // Notify admins of new report/dispute
  private async notifyAdmins(type: 'new_report' | 'new_dispute', id: string): Promise<void> {
    try {
      // Get all admins
      const adminsSnapshot = await getDocs(collection(db, 'admins'));
      
      // Create notification for each admin
      const notifications = adminsSnapshot.docs.map(adminDoc => {
        return addDoc(collection(db, collections.notifications), {
          userId: adminDoc.id,
          type: type === 'new_report' ? 'moderation_alert' : 'dispute_alert',
          title: type === 'new_report' ? 'New Report Submitted' : 'New Dispute Created',
          message: type === 'new_report' 
            ? `A new content report needs review (ID: ${id})`
            : `A new rental dispute requires attention (ID: ${id})`,
          status: 'unread',
          createdAt: serverTimestamp(),
          metadata: {
            reportId: type === 'new_report' ? id : undefined,
            disputeId: type === 'new_dispute' ? id : undefined,
          },
        });
      });

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying admins:', error);
      // Don't throw - notification failure shouldn't break the main flow
    }
  }

  // Notify dispute parties
  private async notifyDisputeParties(
    disputeId: string,
    initiatorId: string,
    respondentId: string
  ): Promise<void> {
    try {
      await Promise.all([
        addDoc(collection(db, collections.notifications), {
          userId: initiatorId,
          type: 'dispute_created',
          title: 'Dispute Created',
          message: 'Your dispute has been submitted and is under review',
          status: 'unread',
          createdAt: serverTimestamp(),
          metadata: { disputeId },
        }),
        addDoc(collection(db, collections.notifications), {
          userId: respondentId,
          type: 'dispute_alert',
          title: 'New Dispute',
          message: 'A dispute has been filed regarding your rental',
          status: 'unread',
          createdAt: serverTimestamp(),
          metadata: { disputeId },
        }),
      ]);
    } catch (error) {
      console.error('Error notifying dispute parties:', error);
    }
  }
}

export const moderationService = new ModerationService();
export default moderationService;
