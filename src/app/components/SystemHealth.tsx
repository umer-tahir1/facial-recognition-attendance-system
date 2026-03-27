import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabaseFunctionName, supabaseFunctionsBaseUrl } from '../../utils/supabase/config';

interface HealthCheck {
  name: string;
  status: 'checking' | 'success' | 'error' | 'warning';
  message: string;
}

export function SystemHealth() {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { name: 'Face API Models', status: 'checking', message: 'Loading...' },
    { name: 'Backend Connection', status: 'checking', message: 'Connecting...' },
    { name: 'Camera Access', status: 'checking', message: 'Checking permissions...' }
  ]);

  useEffect(() => {
    performHealthChecks();
  }, []);

  const performHealthChecks = async () => {
    const newChecks = [...checks];

    // Check Face API Models
    try {
      const response = await fetch('/models/tiny_face_detector_model-weights_manifest.json');
      if (response.ok) {
        newChecks[0] = { name: 'Face API Models', status: 'success', message: 'Models loaded successfully' };
      } else {
        newChecks[0] = { name: 'Face API Models', status: 'error', message: 'Failed to load models' };
      }
    } catch (error) {
      newChecks[0] = { name: 'Face API Models', status: 'error', message: 'Models not accessible' };
    }

    // Check Backend Connection
    try {
      let response = await fetch(`${supabaseFunctionsBaseUrl}/health`);
      if (response.status === 404) {
        response = await fetch(`${supabaseFunctionsBaseUrl}/${supabaseFunctionName}/health`);
      }
      if (response.ok) {
        newChecks[1] = { name: 'Backend Connection', status: 'success', message: 'Server is running' };
      } else {
        newChecks[1] = { name: 'Backend Connection', status: 'error', message: 'Server error' };
      }
    } catch (error) {
      newChecks[1] = { name: 'Backend Connection', status: 'error', message: 'Cannot connect to server' };
    }

    // Check Camera Access
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      if (hasCamera) {
        newChecks[2] = { name: 'Camera Access', status: 'success', message: 'Camera detected' };
      } else {
        newChecks[2] = { name: 'Camera Access', status: 'warning', message: 'No camera detected' };
      }
    } catch (error) {
      newChecks[2] = { name: 'Camera Access', status: 'warning', message: 'Camera permissions needed' };
    }

    setChecks(newChecks);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg border">
      <h3 className="font-semibold mb-3">System Health</h3>
      <div className="space-y-2">
        {checks.map((check, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex items-center gap-3">
              {getStatusIcon(check.status)}
              <div>
                <p className="font-medium text-sm">{check.name}</p>
                <p className="text-xs text-gray-600">{check.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
