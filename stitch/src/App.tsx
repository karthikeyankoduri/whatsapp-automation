import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Upload, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import UploadsTab from './components/UploadsTab';
import PreferencesTab from './components/PreferencesTab';
import SecurityBadge from './components/SecurityBadge';

type Tab = 'campaigns' | 'uploads' | 'preferences';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');

  const renderContent = () => {
    switch (activeTab) {
      case 'campaigns':
        return <Dashboard />;
      case 'uploads':
        return <UploadsTab />;
      case 'preferences':
        return <PreferencesTab />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-50 overflow-hidden text-zinc-900">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-200">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <LayoutDashboard size={24} />
            Campaigns
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'campaigns'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <LayoutDashboard size={18} />
            Campaigns
          </button>
          <button
            onClick={() => setActiveTab('uploads')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'uploads'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <Upload size={18} />
            Uploads
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'preferences'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <Settings size={18} />
            Preferences
          </button>
        </nav>
        <div className="p-4 border-t border-zinc-200">
          <SecurityBadge />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center px-8 shadow-sm z-10">
          <h2 className="text-lg font-semibold capitalize text-zinc-800">
            {activeTab}
          </h2>
        </header>
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
      
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
