'use client';

import { useState } from 'react';
import { User, Settings, Shield, Bell, Key, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="animate-fade-in max-w-[800px] mx-auto">
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Settings</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Manage your account, organization, and API keys.
      </p>

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-[200px] shrink-0 space-y-1">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'organization', label: 'Organization', icon: Shield },
            { id: 'api-keys', label: 'API Keys', icon: Key },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'general', label: 'General', icon: Settings },
          ].map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                activeTab === tab.id 
                  ? 'bg-[#FFF8F0] text-[#FF4400] font-bold' 
                  : 'text-[#555] hover:bg-white hover:text-[#1a1a1a] font-medium'
              }`}
            >
              <tab.icon size={16} />
              <span className="text-[13px]">{tab.label}</span>
            </div>
          ))}
          
          <div className="h-px bg-[#f0ebe1] my-4" />
          
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-red-500 hover:bg-red-50 transition-colors font-medium">
            <LogOut size={16} />
            <span className="text-[13px]">Sign Out</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="dashed-card">
                <span className="section-label block mb-4">PERSONAL INFORMATION</span>
                <div className="flex items-center gap-6 mb-6">
                  <div className="w-16 h-16 rounded-full bg-[#FF4400] text-white flex items-center justify-center text-xl font-bold">
                    JD
                  </div>
                  <div>
                    <button className="btn-outline px-4 py-2">Upload Photo</button>
                    <p className="text-[11px] text-[#999] mt-2">JPG or PNG, max 1MB</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-bold text-[#555] mb-1.5 block">Full Name</label>
                    <input type="text" defaultValue="John Dev" className="w-full h-10 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl px-3 text-[13px] outline-none focus:border-[#FF4400]" />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold text-[#555] mb-1.5 block">Email Address</label>
                    <input type="email" defaultValue="john@company.com" className="w-full h-10 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl px-3 text-[13px] outline-none focus:border-[#FF4400]" />
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button className="btn-coral">Save Changes</button>
                </div>
              </div>

              <div className="dashed-card border-red-200">
                <span className="section-label block mb-4 text-red-500">DANGER ZONE</span>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-bold text-[#1a1a1a]">Delete Account</div>
                    <div className="text-[12px] text-[#888]">Permanently delete your account and all associated data.</div>
                  </div>
                  <button className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[13px] px-4 py-2 rounded-lg transition-colors border border-red-200">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api-keys' && (
            <div className="space-y-6">
              <div className="dashed-card">
                <div className="flex items-center justify-between mb-6">
                  <span className="section-label">API KEYS</span>
                  <button className="btn-coral px-4 py-2 text-[12px]">Generate New Key</button>
                </div>
                
                <div className="space-y-3">
                  <div className="border border-[#f0ebe1] rounded-xl p-4 bg-white flex justify-between items-center">
                    <div>
                      <div className="text-[13px] font-bold text-[#1a1a1a] mb-1">Production Key</div>
                      <div className="text-[12px] text-[#888] font-mono">sk-prod-••••••••••••••••</div>
                    </div>
                    <div className="text-[11px] text-[#999]">Created: Oct 12, 2025</div>
                  </div>
                  <div className="border border-[#f0ebe1] rounded-xl p-4 bg-white flex justify-between items-center opacity-70">
                    <div>
                      <div className="text-[13px] font-bold text-[#1a1a1a] mb-1">Development Key</div>
                      <div className="text-[12px] text-[#888] font-mono">sk-test-••••••••••••••••</div>
                    </div>
                    <div className="text-[11px] text-[#999]">Created: Oct 12, 2025</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
