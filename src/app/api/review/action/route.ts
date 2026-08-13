import { NextResponse } from 'next/server';
import { getSession } from '@/modules/auth/session';
import { approveAssignment, requestRevision, declineAssignment } from '@/modules/tasks/actions';
import {
  approveAssessmentSubmission,
  requestAssessmentRevision,
  approveAssessmentMentorStep,
} from '@/modules/workspaces/assessmentActions';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as any;
    const {
      actionType,
      assignmentId,
      sparks,
      noteText,
      isAssessmentCoordStep,
      isAssessmentMentorStep,
      workspaceId,
    } = body;

    if (!assignmentId) {
      return NextResponse.json({ success: false, error: 'Missing assignmentId' }, { status: 400 });
    }

    let result;
    if (actionType === 'APPROVE') {
      if (isAssessmentCoordStep) {
        result = await approveAssessmentSubmission(assignmentId, workspaceId || '', sparks || 8, noteText || '');
      } else if (isAssessmentMentorStep) {
        result = await approveAssessmentMentorStep(assignmentId, workspaceId || '');
      } else {
        result = await approveAssignment(assignmentId, sparks, noteText || '');
      }
    } else if (actionType === 'REVISION') {
      if (isAssessmentCoordStep || isAssessmentMentorStep) {
        result = await requestAssessmentRevision(assignmentId, workspaceId || '', noteText || '');
      } else {
        result = await requestRevision(assignmentId, noteText || '');
      }
    } else if (actionType === 'DECLINE') {
      result = await declineAssignment(assignmentId, noteText || '');
    } else {
      return NextResponse.json({ success: false, error: 'Invalid actionType' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Review action API endpoint error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
