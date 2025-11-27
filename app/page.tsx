'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseClient } from '@/utils/supabase/client';
import ChartSection from '@/components/ChartSection';
import SOVAnalysis from '@/components/SOVAnalysis';
import AIChatSection from '@/components/AIChatSection';
import HeyGenAvatar from '@/components/HeyGenAvatar';
import { parseCurrency } from '@/utils/format';
import MenaMap from '@/components/MenaMap';
import { Send, Bot, User, BarChart3, Globe, Filter, X } from 'lucide-react';
import BackgroundDecorations from '@/components/BackgroundDecorations';

export default function Dashboard() {
  const supabase = createSupabaseClient();

  const [stats, setStats] = useState<any[]>([]);
  const [filteredStats, setFilteredStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMedia, setSelectedMedia] = useState('All');
  const [selectedChannel, setSelectedChannel] = useState('All');

  // Available filter options
  const [countries, setCountries] = useState<string[]>(['All']);
  const [brands, setBrands] = useState<string[]>(['All']);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [medias, setMedias] = useState<string[]>(['All']);
  const [channels, setChannels] = useState<string[]>(['All']);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAiLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsAiLoading(true);

    let hasContent = false;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        // Add placeholder message
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
        }]);

        let assistantContent = '';

        try {
          let readCount = 0;
          const maxReads = 1000; // Safety limit

          while (readCount < maxReads) {
            readCount++;

            let readResult;
            try {
              readResult = await reader.read();
            } catch (readError: any) {
              // Stream closed or read error
              console.warn('Stream read failed:', readError.message);
              break; // Exit loop gracefully
            }

            if (!readResult || readResult.done) break;

            const { value } = readResult;
            if (!value) continue;

            // Decode chunk as plain text
            try {
              const chunk = decoder.decode(value, { stream: true });
              assistantContent += chunk;

              // Update message in real-time (batch updates every 50ms to avoid too many renders)
              setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
                  newMessages[newMessages.length - 1] = {
                    ...newMessages[newMessages.length - 1],
                    content: assistantContent,
                  };
                }
                return newMessages;
              });
            } catch (decodeError: any) {
              console.warn('Decode error:', decodeError.message);
              continue; // Skip this chunk
            }
          }

          // Mark that we have content
          if (assistantContent.trim()) {
            hasContent = true;
          }
        } finally {
          // Clean up reader
          try {
            if (reader) {
              reader.releaseLock();
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }

      // If we successfully got content, exit successfully (no error)
      if (hasContent) {
        setIsAiLoading(false);
        return;
      }
    } catch (error: any) {
      // Don't let errors crash the app
      console.error('Chat error:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });

      // If we have content despite error, keep it and don't show error message
      if (hasContent) {
        setIsAiLoading(false);
        return;
      }

      // Update the last message if it exists and has content (partial response before error)
      // Otherwise add a new error message
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          // If we have partial content, keep it and note there was an error
          if (lastMsg.content && lastMsg.content.trim()) {
            return prev; // Keep the partial response, don't add error
          } else {
            // Replace empty placeholder with error message
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              content: `Sorry, I encountered an error: ${error?.message || 'Unknown error'}. Please try again.`,
            };
            return newMessages;
          }
        } else {
          // No assistant message yet, add error message
          return [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Sorry, I encountered an error: ${error?.message || 'Unknown error'}. Please try again.`,
          }];
        }
      });
    } finally {
      setIsAiLoading(false);
    }
  }, [input, messages, isAiLoading]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        // First get the total count to know how many requests we need
        const countResult = await supabase
          .from('unified_competitive_stats')
          .select('*', { count: 'exact', head: true });

        const totalRows = countResult.count || 0;
        const batchSize = 1000;
        const batches = Math.ceil(totalRows / batchSize);

        const promises = [];
        for (let i = 0; i < batches; i++) {
          const from = i * batchSize;
          const to = from + batchSize - 1;

          promises.push(
            supabase
              .from('unified_competitive_stats')
              .select('*')
              .range(from, to)
          );
        }

        // Execute all requests in parallel
        const results = await Promise.all(promises);

        let allData: any[] = [];
        results.forEach(result => {
          if (result.data) {
            allData = [...allData, ...result.data];
          }
          if (result.error) {
            console.error('Error fetching batch:', result.error);
          }
        });

        // Smart Merge Logic:
        // 1. Check if we have specific 'online' source data
        const hasOnlineSource = allData.some(item => item.source === 'online');

        let processedData = allData;
        if (hasOnlineSource) {
          // If we have specific online data, use it for 'ONLINE' media and exclude 'overall' version of 'ONLINE'
          processedData = allData.filter(item => {
            if (item.source === 'online') return true;
            if (item.source === 'overall' && item.media === 'ONLINE') return false; // Exclude duplicate
            return true; // Keep other 'overall' data (TV, Radio, etc.)
          });
        }

        setStats(processedData);
        setFilteredStats(processedData);

        // Extract unique values for all filters
        const uniqueCountries = Array.from(new Set(processedData.map((item) => item.country).filter(Boolean) as string[]));
        const uniqueBrands = Array.from(new Set(processedData.map((item) => item.brand).filter(Boolean) as string[]));
        const uniqueCategories = Array.from(new Set(processedData.map((item) => item.category).filter(Boolean) as string[]));
        const uniqueMedias = Array.from(new Set(processedData.map((item) => item.media).filter(Boolean) as string[]));
        const uniqueChannels = Array.from(new Set(processedData.map((item) => item.channel).filter(Boolean) as string[]));

        setCountries(['All', ...uniqueCountries.sort()]);
        setBrands(['All', ...uniqueBrands.sort()]);
        setCategories(['All', ...uniqueCategories.sort()]);
        setMedias(['All', ...uniqueMedias.sort()]);
        setChannels(['All', ...uniqueChannels.sort()]);
      } catch (error) {
        console.error('Error in fetchAllData:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Apply all filters
  useEffect(() => {
    let filtered = stats;

    if (selectedCountry !== 'All') {
      filtered = filtered.filter((s) => s.country === selectedCountry);
    }
    if (selectedBrand !== 'All') {
      filtered = filtered.filter((s) => s.brand === selectedBrand);
    }
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }
    if (selectedMedia !== 'All') {
      filtered = filtered.filter((s) => s.media === selectedMedia);
    }
    if (selectedChannel !== 'All') {
      filtered = filtered.filter((s) => s.channel === selectedChannel);
    }

    setFilteredStats(filtered);
  }, [selectedCountry, selectedBrand, selectedCategory, selectedMedia, selectedChannel, stats]);

  // Calculate aggregate metrics
  const campaignCount = filteredStats.length;
  const totalBudget = filteredStats.reduce((acc, curr) => acc + parseCurrency(curr.budget), 0);
  const uniqueBrandsCount = new Set(filteredStats.map((s) => s.brand).filter(Boolean)).size;

  const clearFilters = () => {
    setSelectedCountry('All');
    setSelectedBrand('All');
    setSelectedCategory('All');
    setSelectedMedia('All');
    setSelectedChannel('All');
  };

  const activeFiltersCount = [selectedCountry, selectedBrand, selectedCategory, selectedMedia, selectedChannel].filter(
    (f) => f !== 'All'
  ).length;

  return (
    <div className="min-h-screen bg-[#f4ede2] text-[#431412] font-sans relative">
      {/* Background Decorations */}
      <BackgroundDecorations />

      {/* Header */}
      <header className="bg-white border-b border-[#431412]/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/talabat_orange_LOGO.png" alt="Talabat Logo" className="h-8 object-contain" />
            <div className="h-8 w-px bg-[#431412]/20"></div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#431412]">MENA DECODER</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#431412]/70">
            <Globe className="w-4 h-4" />
            <span>Region: MENA</span>
          </div>
        </div>
      </header>

      {/* Sticky Filters Section */}
      <div className="sticky top-16 z-40 bg-[#f4ede2] pt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[#431412]/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#FF5900]" />
              <h2 className="text-lg font-bold text-[#431412]">Filters</h2>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-1 bg-[#CFFF00] text-[#431412] text-xs font-medium rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#431412]/70 hover:text-[#431412] hover:bg-[#F4EDE3] rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#431412]/70 mb-1">Country</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full rounded-md border-[#431412]/20 text-sm p-2 border bg-white text-[#431412] focus:ring-2 focus:ring-[#FF5900]"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#431412]/70 mb-1">Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full rounded-md border-[#431412]/20 text-sm p-2 border bg-white text-[#431412] focus:ring-2 focus:ring-[#FF5900]"
              >
                {brands.slice(0, 50).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#431412]/70 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md border-[#431412]/20 text-sm p-2 border bg-white text-[#431412] focus:ring-2 focus:ring-[#FF5900]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#431412]/70 mb-1">Media</label>
              <select
                value={selectedMedia}
                onChange={(e) => setSelectedMedia(e.target.value)}
                className="w-full rounded-md border-[#431412]/20 text-sm p-2 border bg-white text-[#431412] focus:ring-2 focus:ring-[#FF5900]"
              >
                {medias.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#431412]/70 mb-1">Channel</label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full rounded-md border-[#431412]/20 text-sm p-2 border bg-white text-[#431412] focus:ring-2 focus:ring-[#FF5900]"
              >
                {channels.slice(0, 50).map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Map and KPIs */}
        <div className="flex flex-col lg:flex-row gap-8 mb-8">
          {/* Map Section */}
          <div className="lg:w-1/2">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-[#431412]/10">
              <h3 className="text-lg font-bold text-[#431412] mb-4">Regional View</h3>
              <MenaMap selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
            </div>
          </div>

          {/* KPI Cards */}
          <div className="lg:w-1/2 flex flex-col gap-4">
            <h2 className="text-2xl font-extrabold text-[#431412]">Market Overview</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10 flex flex-col justify-center">
                <p className="text-sm font-semibold text-[#431412]/70">Campaigns</p>
                <p className="text-3xl font-extrabold text-[#FF5900] mt-2">{campaignCount.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10 flex flex-col justify-center">
                <p className="text-sm font-semibold text-[#431412]/70">Active Brands</p>
                <p className="text-3xl font-extrabold text-[#FF5900] mt-2">{uniqueBrandsCount}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-[#431412]/10 flex flex-col justify-center sm:col-span-2">
                <p className="text-sm font-semibold text-[#431412]/70">Total Budget Spend</p>
                <p className="text-3xl font-extrabold text-[#FF5900] mt-2">${totalBudget.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        {/* Charts Section */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5900]"></div>
            <p className="mt-2 text-[#431412]/70">Loading data...</p>
          </div>
        ) : (
          <ChartSection data={filteredStats} />
        )}

        {/* SOV Analysis Section */}
        <div className="mt-8">
          <SOVAnalysis data={stats} />
        </div>

        {/* AI Analyst Section */}
        <AIChatSection
          messages={messages}
          isLoading={isAiLoading}
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
        />
      </main>

      {/* HeyGen AI Avatar - Bottom Right Corner */}
      <HeyGenAvatar />
    </div>
  );
}
