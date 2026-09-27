import { useContext } from 'react';
import { RobotContext } from '../context/RobotContext';

export const useRobotStatus = () => {
  const context = useContext(RobotContext);
  if (!context) throw new Error('useRobotStatus must be used within RobotProvider');
  return context;
};
