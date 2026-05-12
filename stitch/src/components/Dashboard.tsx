import { useState } from 'react';
import CampaignForm from './CampaignForm';
import CampaignTable from './CampaignTable';
import { Layers } from 'lucide-react';

export default function Dashboard() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCampaignCreated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
          <Layers size={140} className="absolute -right-8 -bottom-8 opacity-10 text-white" />
          <h2 className="text-2xl font-bold mb-2">New Campaign</h2>
          <p className="text-indigo-100 text-sm max-w-sm mb-6">Create and dispatch personalized messages targeting specific subsets of your contacts.</p>
        </div>
        <CampaignForm onCreated={handleCampaignCreated} />
      </div>
      <div className="lg:col-span-7">
        <CampaignTable refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
