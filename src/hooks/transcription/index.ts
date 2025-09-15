/**
 * Transcription Hooks
 *
 * Modular hooks for speech-to-text and AI analysis functionality
 */

export { useTranscription } from './useTranscription';
export { useTranscriptionExtended, useTranscriptionCompat } from './useTranscriptionExtended';
export { useTranscriptionState } from './useTranscriptionState';
export { useTranscriptionServices } from './useTranscriptionServices';
export { useTranscriptionCallbacks } from './useTranscriptionCallbacks';
export { useTranscriptionCore } from './useTranscriptionCore';
export { useTranscriptionRecording } from './useTranscriptionRecording';
export { useTranscriptionRecordingExtended } from './useTranscriptionRecordingExtended';

export type { UseTranscriptionReturn } from './useTranscription';
export type { UseTranscriptionExtendedReturn, UseTranscriptionExtendedOptions } from './useTranscriptionExtended';
export type { AudioSourceType } from './useTranscriptionRecordingExtended';
