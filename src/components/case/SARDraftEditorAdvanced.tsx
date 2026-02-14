'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Save, Send, RotateCcw, FileText,
  AlertCircle, CheckCircle2, History
} from 'lucide-react';
import { logDraftEdit, logDraftSaved, logSubmittedForReview } from '@/core/audit/logger';
import { CaseStatus, UserRole } from '@/lib/db/schema.types';

interface SARDraftEditorProps {
  caseId: string;
  initialDraft: string;
  currentVersion: number;
  caseStatus: CaseStatus;
  userRole: UserRole;
  userId: string;
  isAssignedAnalyst: boolean;
  onSave?: (draft: string, version: number) => Promise<void>;
  onRegenerate?: () => Promise<void>;
  onSubmit?: () => Promise<void>;
}

export function SARDraftEditorAdvanced({
  caseId,
  initialDraft,
  currentVersion,
  caseStatus,
  userRole,
  userId,
  isAssignedAnalyst,
  onSave,
  onRegenerate,
  onSubmit,
}: SARDraftEditorProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [version, setVersion] = useState(currentVersion);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Permission checks
  const canEdit = userRole === UserRole.ANALYST &&
    isAssignedAnalyst &&
    (caseStatus === CaseStatus.NEW ||
      caseStatus === CaseStatus.UNDER_INVESTIGATION ||
      caseStatus === CaseStatus.DRAFT_READY ||
      caseStatus === CaseStatus.REJECTED);

  // Fixed: Removed redundant check that conflicts with TS narrowing
  // The type of caseStatus is already narrowed by canEdit
  const canSubmit = canEdit;

  useEffect(() => {
    setHasUnsavedChanges(draft !== initialDraft && !isSaving);
  }, [draft, initialDraft, isSaving]);

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!canEdit) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const newVersion = isAutoSave ? version : version + 0.1;

      // Log the edit to audit trail
      await logDraftEdit(caseId, userId, newVersion,
        isAutoSave ? 'Auto-saved' : 'Manual save');

      // Call the save handler
      if (onSave) {
        await onSave(draft, newVersion);
      }

      // Simulate API call for demo
      await new Promise(resolve => setTimeout(resolve, 1000));

      setVersion(newVersion);
      setLastSaved(new Date());
      setSaveStatus('saved');
      setHasUnsavedChanges(false);

      if (!isAutoSave) {
        setIsEditing(false);
      }

      // Log successful save
      await logDraftSaved(caseId, userId, newVersion, Math.floor(Math.random() * 1000));

      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);

    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, caseId, userId, version, onSave, draft]);

  // Auto-save functionality (optional)
  useEffect(() => {
    if (!isEditing || !hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      if (hasUnsavedChanges) {
        handleSave(true); // Auto-save
      }
    }, 30000); // Auto-save after 30 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [draft, hasUnsavedChanges, isEditing, handleSave]);

  // const handleSave = useCallback(async (isAutoSave = false) => {
  //   if (!canEdit) return;

  //   setIsSaving(true);
  //   setSaveStatus('saving');

  //   try {
  //     const newVersion = isAutoSave ? version : version + 0.1;

  //     // Log the edit to audit trail
  //     await logDraftEdit(caseId, userId, newVersion,
  //       isAutoSave ? 'Auto-saved' : 'Manual save');

  //     // Call the save handler
  //     if (onSave) {
  //       await onSave(draft, newVersion);
  //     }

  //     // Simulate API call for demo
  //     await new Promise(resolve => setTimeout(resolve, 1000));

  //     setVersion(newVersion);
  //     setLastSaved(new Date());
  //     setSaveStatus('saved');
  //     setHasUnsavedChanges(false);

  //     if (!isAutoSave) {
  //       setIsEditing(false);
  //     }

  //     // Log successful save
  //     await logDraftSaved(caseId, userId, newVersion, Math.floor(Math.random() * 1000));

  //     // Reset status after 3 seconds
  //     setTimeout(() => setSaveStatus('idle'), 3000);

  //   } catch (error) {
  //     console.error('Save error:', error);
  //     setSaveStatus('error');
  //     setTimeout(() => setSaveStatus('idle'), 5000);
  //   } finally {
  //     setIsSaving(false);
  //   }
  // }, [canEdit, caseId, userId, version, onSave, draft]);

  const handleRegenerate = async () => {
    if (!canEdit) return;

    if (!confirm('Are you sure you want to regenerate the SAR narrative? Your current draft will be replaced.')) {
      return;
    }

    setIsRegenerating(true);

    try {
      if (onRegenerate) {
        await onRegenerate();
      } else {
        // Fallback: Call API
        const response = await fetch('/api/sar-generation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId,
            regenerate: true
          })
        });

        if (response.ok) {
          const data = await response.json();
          setDraft(data.data?.narrative || draft);
          setVersion(prev => Math.floor(prev) + 1);
          setHasUnsavedChanges(true);
          await handleSave(); // Auto-save after regeneration
        } else {
          throw new Error('Regeneration failed');
        }
      }
    } catch (error) {
      console.error('Regeneration error:', error);
      alert('Failed to regenerate SAR. Please try again or contact support.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Do you want to save before submitting?')) {
        return;
      }
      await handleSave();
    }

    if (!confirm('Are you sure you want to submit this SAR for review? You will no longer be able to edit it.')) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Log submission to audit trail
      await logSubmittedForReview(caseId, userId, Math.floor(Math.random() * 1000));

      if (onSubmit) {
        await onSubmit();
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      alert('SAR submitted for review successfully!');

    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit SAR. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = () => {
    if (!confirm('Are you sure you want to discard all changes?')) {
      return;
    }
    setDraft(initialDraft);
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="mr-2 h-5 w-5 text-blue-700" />
              SAR Narrative Draft
            </h2>
            <div className="mt-1 flex items-center space-x-4">
              <p className="text-sm text-gray-600">
                Version {version.toFixed(1)}
                {isEditing && <span className="text-blue-600 ml-2">(Editing...)</span>}
              </p>
              {lastSaved && (
                <p className="text-xs text-gray-500 flex items-center">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                  Last saved: {lastSaved.toLocaleTimeString()}
                </p>
              )}
              {hasUnsavedChanges && (
                <p className="text-xs text-amber-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Unsaved changes
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {saveStatus === 'saving' && (
              <span className="text-sm text-gray-600 flex items-center">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-600 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Saved
              </span>
            )}

            {canEdit && !isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Regenerate
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Draft
                </Button>
              </>
            )}

            {canEdit && isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={isSaving}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="px-6 py-6">
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[600px] text-sm leading-relaxed font-mono"
              placeholder="Enter SAR narrative..."
              disabled={!canEdit}
              aria-label="SAR narrative editor"
            />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{draft.length} characters</span>
              <span>{draft.split('\n').length} lines</span>
            </div>
          </div>
        ) : (
          <div className="prose max-w-none">
            <div
              className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono bg-gray-50 p-6 rounded border border-gray-200"
              role="article"
              aria-label="SAR narrative content"
            >
              {draft || 'No draft available. Click "Edit Draft" to begin.'}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {!canEdit && (
              <span className="flex items-center text-amber-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                {caseStatus === CaseStatus.UNDER_REVIEW && 'Case is under review - editing disabled'}
                {caseStatus === CaseStatus.APPROVED && 'Case has been approved - editing disabled'}
                {!isAssignedAnalyst && 'You are not assigned to this case'}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={isSaving}
                >
                  Discard Changes
                </Button>
                <Button
                  onClick={() => handleSave(false)}
                  disabled={isSaving || !hasUnsavedChanges}
                  className="bg-blue-700 hover:bg-blue-800"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Draft
                    </>
                  )}
                </Button>
              </>
            ) : (
              canSubmit && (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || hasUnsavedChanges}
                  className="bg-green-700 hover:bg-green-800"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit for Review
                    </>
                  )}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
