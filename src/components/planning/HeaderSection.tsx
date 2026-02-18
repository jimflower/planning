import React, { useState, useEffect } from 'react';
import { usePlanningStore } from '@/store/planningStore';
import { useProcoreData } from '@/hooks/useProcoreData';
import { procoreService } from '@/services/procore.service';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { ProcoreProject, ProcorePrimeContract } from '@/types/procore.types';

/** Extract client / owner name from a prime contract.
 *  Scans known fields, then dynamic fields. Never returns the contract title. */
function extractClient(contract: ProcorePrimeContract): string {
  // Log everything so we can discover where the real client lives
  const interesting: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(contract)) {
    if (v != null && v !== '' && typeof v !== 'number') interesting[k] = v;
  }
  console.log('[extractClient] Non-empty fields:', interesting);

  // 1. vendor — in Procore prime contracts, "vendor" is often the Owner/Developer/Client
  if (contract.vendor && typeof contract.vendor === 'object' && contract.vendor.name)
    return contract.vendor.name;

  // 2. Owner on the contract
  if (contract.owner && typeof contract.owner === 'object' && contract.owner.name)
    return contract.owner.name;

  // 3. bill_to
  if (contract.bill_to && typeof contract.bill_to === 'string') return contract.bill_to;
  if (contract.bill_to && typeof contract.bill_to === 'object' && (contract.bill_to as {name?:string}).name)
    return (contract.bill_to as {name:string}).name;

  // 4. Architect
  if (contract.architect && typeof contract.architect === 'object' && contract.architect.name)
    return contract.architect.name;

  // 5. Scan ALL keys for anything client/customer/owner/developer related
  for (const key of Object.keys(contract)) {
    // Skip amount/total/percentage fields that happen to contain "owner" etc.
    if (/amount|total|percent|date|number|position|id$/i.test(key)) continue;
    if (/client|customer|bill|owner|developer/i.test(key)) {
      const val = contract[key];
      if (typeof val === 'string' && val.trim() && !/^\d/.test(val)) return val;
      if (val && typeof val === 'object' && 'name' in (val as Record<string, unknown>)) {
        return (val as { name: string }).name;
      }
    }
  }

  // 6. Look for any object field with a .name that is NOT GNB Energy or contractor
  const skip = /gnb|template|standard|head contract/i;
  for (const [key, val] of Object.entries(contract)) {
    if (['contractor', 'creator', 'created_by', 'company'].includes(key)) continue;
    if (/amount|total|percent|date|number|position/i.test(key)) continue;
    if (val && typeof val === 'object' && !Array.isArray(val) && 'name' in (val as Record<string, unknown>)) {
      const name = (val as { name: string }).name;
      if (name && !skip.test(name)) {
        console.log(`[extractClient] Found name in field "${key}":`, name);
        return name;
      }
    }
  }

  // NEVER return the title — it's usually "Standard Head Contract Template"
  return '';
}

/** Extract owner/client name(s) from project detail response */
function extractClientFromProjectDetail(detail: Record<string, unknown>): string[] {
  const results: string[] = [];
  const skip = /gnb|template|standard/i;

  // Check known project fields
  for (const key of ['owner', 'client', 'developer', 'owner_developer', 'customer', 'principal']) {
    const val = detail[key];
    if (!val) continue;
    if (typeof val === 'string' && val.trim() && !skip.test(val)) {
      results.push(val);
    } else if (typeof val === 'object' && val !== null && 'name' in val) {
      const name = (val as { name: string }).name;
      if (name && !skip.test(name)) results.push(name);
    }
  }

  // Check custom_fields / custom_field_values
  for (const cfKey of ['custom_fields', 'custom_field_values', 'project_custom_fields']) {
    const cf = detail[cfKey];
    if (cf && typeof cf === 'object') {
      for (const [k, v] of Object.entries(cf as Record<string, unknown>)) {
        if (/owner|client|developer|customer|principal/i.test(k)) {
          if (typeof v === 'string' && v.trim() && !skip.test(v)) results.push(v);
          if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
            const val = (v as { value: string }).value;
            if (val && !skip.test(val)) results.push(val);
          }
        }
      }
    }
  }

  // Scan all string fields for anything owner/client related  
  for (const [key, val] of Object.entries(detail)) {
    if (/owner|client|developer|principal/i.test(key) && !results.length) {
      if (typeof val === 'string' && val.trim() && !skip.test(val)) results.push(val);
    }
  }

  return [...new Set(results)];
}

export function HeaderSection() {
  const { currentPlan, setField } = usePlanningStore();
  const { projects, connected } = useProcoreData();
  const [subJobs, setSubJobs] = useState<ProcoreProject[]>([]);
  const [primeContracts, setPrimeContracts] = useState<ProcorePrimeContract[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);

  // Filter to only active top-level projects
  const topLevelProjects = projects
    .filter((p) => p.active && !p.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedProjectNumber = currentPlan.projectNumber;

  // When user picks a project, look up its subjobs
  useEffect(() => {
    if (!connected || !selectedProjectNumber) {
      setSubJobs([]);
      return;
    }
    const proj = projects.find(
      (p) => p.project_number === selectedProjectNumber || p.name === selectedProjectNumber,
    );
    if (!proj) {
      setSubJobs([]);
      return;
    }
    console.log(`[SubJob] Fetching sub jobs for project ${proj.id} (${proj.name})`);

    procoreService.getSubJobs(proj.id)
      .then((subs) => {
        console.log(`[SubJob] Got ${subs.length} sub jobs`);
        setSubJobs(subs.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((err) => {
        console.error(`[SubJob] Failed:`, err);
        setSubJobs([]);
      });
  }, [connected, selectedProjectNumber, projects]);

  // When a project with sub jobs is selected, fetch all contracts + their details
  // so we can match sub job cost codes in scheduled items (line_items)
  useEffect(() => {
    if (subJobs.length === 0 || !connected) {
      setClientOptions([]);
      return;
    }

    const proj = projects.find(
      (p) => p.project_number === selectedProjectNumber || p.name === selectedProjectNumber,
    );
    if (!proj) return;
    if (primeContracts.length === 0) return;

    // The list endpoint doesn't include line_items — fetch details for each contract
    console.log(`[Client] Fetching details for ${primeContracts.length} contracts to get line_items…`);
    Promise.all(
      primeContracts.map((c) => procoreService.getPrimeContractDetail(proj.id, c.id)),
    ).then((details) => {
      const enriched = details.filter((d): d is NonNullable<typeof d> => d !== null);
      console.log(`[Client] Got ${enriched.length} contract details`);

      // Update stored contracts with full details (including line_items)
      if (enriched.length > 0) {
        setPrimeContracts(enriched);
      }

      // Build client options from contracts that have vendor/owner
      const clients = enriched
        .map((d) => extractClient(d))
        .filter((name) => name.trim() !== '');
      const unique = [...new Set(clients)];
      console.log(`[Client] Client options from contracts:`, unique);
      setClientOptions(unique);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subJobs.length, primeContracts.length > 0 ? primeContracts[0]?.id : 0, connected]);

  const handleProjectChange = (value: string) => {
    setField('projectNumber', value);
    setField('subjobCode', '');
    setField('client', '');
    setPrimeContracts([]);
    setClientOptions([]);

    if (!value || !connected) return;

    const proj = projects.find(
      (p) => p.project_number === value || p.name === value,
    );
    if (!proj) return;

    // Auto-fill location from project address
    const parts = [proj.address, proj.city, proj.state_code].filter(Boolean);
    if (parts.length > 0) setField('location', parts.join(', '));

    // Fetch prime contracts — client logic depends on whether sub jobs exist
    procoreService.getPrimeContracts(proj.id)
      .then((contracts) => {
        console.log(`[HeadContract] Project ${proj.id} contracts:`, contracts.length);
        contracts.forEach((c, i) => {
          console.log(`[HeadContract] Contract[${i}]:`, {
            title: c.title,
            number: c.number,
            status: c.status,
            vendor: c.vendor,
            owner: c.owner,
            contractor: c.contractor,
            bill_to: c.bill_to,
            architect: c.architect,
          });
        });

        // Store contracts — the useEffect will build clientOptions if sub jobs exist
        setPrimeContracts(contracts);

        // Auto-fill client from first contract if possible
        if (contracts.length > 0) {
          const client = extractClient(contracts[0]);
          console.log(`[HeadContract] Extracted client from list:`, client);
          if (client) {
            setField('client', client);
            return;
          }

          // List had no client fields → fetch first contract's detail
          console.log(`[HeadContract] No client from list, trying detail endpoint…`);
          procoreService.getPrimeContractDetail(proj.id, contracts[0].id)
            .then((detail) => {
              if (detail) {
                const detailClient = extractClient(detail);
                console.log(`[HeadContract] Client from detail:`, detailClient);
                if (detailClient) {
                  setField('client', detailClient);
                  setPrimeContracts((prev) =>
                    prev.map((c) => (c.id === detail.id ? { ...c, ...detail } : c)),
                  );
                  return;
                }
              }
              // Fallback to project owner
              if (proj.owner?.name) setField('client', proj.owner.name);
            });
          return;
        }

        // No contracts — fallback to project owner
        if (proj.owner?.name) {
          console.log(`[HeadContract] No contracts, falling back to project owner:`, proj.owner.name);
          setField('client', proj.owner.name);
        }
      })
      .catch((err) => {
        console.error(`[HeadContract] Failed:`, err);
        if (proj.owner?.name) setField('client', proj.owner.name);
      });
  };

  // When a sub job is selected, extract the contract # prefix from the sub job code
  // (e.g., sub job "OH4014 - Description" → contract number "OH4014")
  // then match to a head contract and pull the owner-developer/client from it.
  const handleSubJobChange = async (value: string) => {
    setField('subjobCode', value);
    setField('client', '');

    if (!value || !connected || !selectedProjectNumber) return;

    const proj = projects.find(
      (p) => p.project_number === selectedProjectNumber || p.name === selectedProjectNumber,
    );
    if (!proj) return;

    // Extract the contract number prefix from the sub job value.
    // Sub job codes start with the head contract # (e.g., "OH4014", "OH4014-001",
    // "OH4014 - Some Description"). We grab the leading alphanumeric portion.
    const contractPrefix = value.match(/^[A-Za-z]*\d+/)?.[0] ?? '';
    console.log(`[HeadContract] Sub job selected:`, { value, contractPrefix });

    if (!contractPrefix) return;

    // If contracts haven't been loaded yet, fetch them now
    let contracts = primeContracts;
    if (contracts.length === 0) {
      console.log(`[HeadContract] No contracts loaded yet, fetching for project ${proj.id}…`);
      try {
        contracts = await procoreService.getPrimeContracts(proj.id);
        console.log(`[HeadContract] Fetched ${contracts.length} contracts`);
        if (contracts.length > 0) {
          setPrimeContracts(contracts);
        }
      } catch (err) {
        console.error(`[HeadContract] Failed to fetch contracts:`, err);
        return;
      }
    }

    if (contracts.length === 0) {
      console.log(`[HeadContract] Still 0 contracts after fetch. Check API permissions.`);
      return;
    }

    // Match: find contract whose number starts with (or equals) the extracted prefix
    let match = contracts.find((c) => {
      if (!c.number) return false;
      const cn = c.number.trim();
      return cn === contractPrefix || cn.startsWith(contractPrefix) || contractPrefix.startsWith(cn);
    });

    // Fallback: match by contract title containing the prefix
    if (!match) {
      match = contracts.find((c) =>
        c.title?.includes(contractPrefix) || c.number?.includes(contractPrefix),
      );
    }

    if (!match) {
      console.log(`[HeadContract] No contract matched prefix "${contractPrefix}". Contracts:`,
        contracts.map((c) => ({ id: c.id, number: c.number, title: c.title })));
      if (clientOptions.length === 1) setField('client', clientOptions[0]);
      return;
    }

    console.log(`[HeadContract] Matched contract:`, { id: match.id, number: match.number, title: match.title });

    // Try extracting client from the list data first
    let client = extractClient(match);
    if (client) {
      console.log(`[HeadContract] Client from list data:`, client);
      setField('client', client);
      return;
    }

    // List data didn't have vendor/owner → fetch the full detail
    console.log(`[HeadContract] No client in list data, fetching detail for contract ${match.id}…`);
    const detail = await procoreService.getPrimeContractDetail(proj.id, match.id);
    if (detail) {
      // Update stored contracts with enriched detail
      setPrimeContracts((prev) =>
        prev.map((c) => (c.id === detail.id ? { ...c, ...detail } : c)),
      );
      client = extractClient(detail);
      console.log(`[HeadContract] Client from detail:`, client);
      if (client) {
        setField('client', client);
        return;
      }
    }

    // Final fallback
    if (clientOptions.length === 1) {
      setField('client', clientOptions[0]);
    } else {
      console.log(`[HeadContract] Could not extract client from matched contract. Detail:`,
        detail ? { vendor: detail.vendor, owner: detail.owner, bill_to: detail.bill_to } : 'null');
    }
  };

  return (
    <div className="section-card">
      <h2 className="section-header">Daily Planning Details</h2>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Date */}
        <div>
          <label htmlFor="plan-date" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date
          </label>
          <input
            id="plan-date"
            type="date"
            value={currentPlan.date}
            onChange={(e) => setField('date', e.target.value)}
            className="input-field"
          />
        </div>

        {/* Project — dropdown when Procore connected */}
        <div>
          <label htmlFor="plan-project" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Project #
          </label>
          {connected && topLevelProjects.length > 0 ? (
            <SearchableSelect
              id="plan-project"
              value={currentPlan.projectNumber}
              onChange={handleProjectChange}
              placeholder="Select project…"
              options={topLevelProjects.map((p) => ({
                value: p.project_number || p.name,
                label: p.project_number ? `${p.project_number} – ${p.name}` : p.name,
              }))}
            />
          ) : (
            <input
              id="plan-project"
              type="text"
              placeholder="e.g. PRJ-001"
              value={currentPlan.projectNumber}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="input-field"
            />
          )}
        </div>

        {/* Sub Job — only when the selected project has subjobs */}
        {subJobs.length > 0 && (
          <div>
            <label htmlFor="plan-subjob" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sub Job
            </label>
            <SearchableSelect
              id="plan-subjob"
              value={currentPlan.subjobCode}
              onChange={handleSubJobChange}
              placeholder="Select sub job…"
              options={subJobs.map((s) => ({
                value: s.code || s.project_number || s.name,
                label: s.project_number ? `${s.project_number} – ${s.name}` : s.name,
              }))}
            />
          </div>
        )}

        {/* Client — dropdown when sub jobs exist and we have contract options, otherwise text input */}
        <div>
          <label htmlFor="plan-client" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Client
          </label>
          {clientOptions.length > 0 ? (
            <SearchableSelect
              id="plan-client"
              value={currentPlan.client}
              onChange={(val) => setField('client', val)}
              placeholder="Select client…"
              options={clientOptions.map((name) => ({
                value: name,
                label: name,
              }))}
            />
          ) : (
            <input
              id="plan-client"
              type="text"
              placeholder="Client name"
              value={currentPlan.client}
              onChange={(e) => setField('client', e.target.value)}
              className="input-field"
            />
          )}
        </div>

        {/* Location */}
        <div>
          <label htmlFor="plan-location" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Location
          </label>
          <input
            id="plan-location"
            type="text"
            placeholder="Site location"
            value={currentPlan.location}
            onChange={(e) => setField('location', e.target.value)}
            className="input-field"
          />
        </div>

        {/* Weather — full width */}
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="plan-weather" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Weather
          </label>
          <input
            id="plan-weather"
            type="text"
            placeholder="e.g. Sunny, 28°C, light winds"
            value={currentPlan.weather}
            onChange={(e) => setField('weather', e.target.value)}
            className="input-field"
          />
        </div>
      </div>
    </div>
  );
}
