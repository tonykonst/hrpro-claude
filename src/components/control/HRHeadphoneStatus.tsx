/**
 * HR Headphone Status Component
 * 
 * Отображает статус наушников HR и применяемую стратегию.
 * Соответствует архитектурным принципам hrpro.mdc:
 * - Строгая типизация с интерфейсами
 * - Обработка ошибок с error boundaries
 * - Структурированное логирование
 */

import React from 'react';
import { HRHeadphoneStrategy } from '../../types/IAudioService';
import { Logger } from '../../utils/logger';

interface HRHeadphoneStatusProps {
  hrStrategy: HRHeadphoneStrategy | null;
}

export const HRHeadphoneStatus: React.FC<HRHeadphoneStatusProps> = ({ hrStrategy }) => {
  if (!hrStrategy) {
    return (
      <div className="hr-headphone-status hr-headphone-status--disabled">
        <div className="hr-headphone-status__title">🎧 HR Audio</div>
        <div className="hr-headphone-status__message">No headphone strategy available</div>
      </div>
    );
  }
  
  const getStatusIcon = (strategy: string) => {
    switch (strategy) {
      case 'usb_headphones': return '🎧';
      case 'bluetooth_headphones': return '🔵';
      case 'jack_headphones': return '🔌';
      case 'wireless_headphones': return '📡';
      case 'unknown_headphones': return '❓';
      case 'no_headphones': return '🎤';
      default: return '🎧';
    }
  };
  
  const getStatusColor = (strategy: string) => {
    switch (strategy) {
      case 'usb_headphones':
      case 'jack_headphones': return 'text-green-500';
      case 'bluetooth_headphones': return 'text-blue-500';
      case 'wireless_headphones': return 'text-purple-500';
      case 'unknown_headphones': return 'text-yellow-500';
      case 'no_headphones': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };
  
  const getStatusDescription = (strategy: string) => {
    switch (strategy) {
      case 'usb_headphones':
        return 'USB headphones detected - HR speech may appear in system audio';
      case 'bluetooth_headphones':
        return 'Bluetooth headphones detected - checking connection target';
      case 'jack_headphones':
        return 'Jack headphones detected - monitoring for HR speech';
      case 'wireless_headphones':
        return 'Wireless headphones detected - advanced filtering required';
      case 'unknown_headphones':
        return 'Unknown headphone type - using adaptive detection';
      case 'no_headphones':
        return 'No headphones detected - using standard microphone setup';
      default:
        return 'Unknown strategy';
    }
  };
  
  const handleStrategyClick = () => {
    Logger.info('HR headphone strategy clicked', {
      strategy: hrStrategy.strategy,
      message: hrStrategy.message
    });
  };
  
  return (
    <div 
      className="hr-headphone-status"
      onClick={handleStrategyClick}
      title={getStatusDescription(hrStrategy.strategy)}
    >
      <div className="hr-headphone-status__title">
        {getStatusIcon(hrStrategy.strategy)} HR Audio
      </div>
      
      <div className={`hr-headphone-status__message ${getStatusColor(hrStrategy.strategy)}`}>
        {hrStrategy.message}
      </div>
      
      <div className="hr-headphone-status__actions">
        {hrStrategy.actions.map((action, index) => (
          <div key={index} className="hr-headphone-status__action">
            • {action}
          </div>
        ))}
      </div>
      
      <div className="hr-headphone-status__config">
        <div className="hr-headphone-status__config-item">
          <strong>Candidate Source:</strong> {hrStrategy.configuration.candidateSource}
        </div>
        <div className="hr-headphone-status__config-item">
          <strong>HR Source:</strong> {hrStrategy.configuration.hrSource}
        </div>
        <div className="hr-headphone-status__config-item">
          <strong>System Audio:</strong> {hrStrategy.configuration.monitorSystemAudio ? '✅' : '❌'}
        </div>
        <div className="hr-headphone-status__config-item">
          <strong>HR Suppression:</strong> {hrStrategy.configuration.suppressHRInSystemAudio ? '✅' : '❌'}
        </div>
        {hrStrategy.configuration.useAdvancedFiltering && (
          <div className="hr-headphone-status__config-item">
            <strong>Advanced Filtering:</strong> ✅
          </div>
        )}
        {hrStrategy.configuration.useAdaptiveDetection && (
          <div className="hr-headphone-status__config-item">
            <strong>Adaptive Detection:</strong> ✅
          </div>
        )}
      </div>
    </div>
  );
};
