import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const TRIP_ID = 'trip-maple-lake-001';

function isAuthorized(req: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

    const querySecret = process.env.WEATHER_REFRESH_SECRET;
    if (querySecret) {
        const provided = req.nextUrl.searchParams.get('secret');
        if (provided === querySecret) return true;
    }

    return false;
}

async function scrapeAlgonquinAlerts() {
    console.log('[refresh-alerts] Scraping Algonquin alerts...');
    const url = 'https://www.ontarioparks.ca/park/algonquin/backcountry/alerts';
    let textSample = "Currently checking. Please see Ontario Parks site for full details.";
    let severity = 'info';

    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, next: { revalidate: 0 } });
        if (res.ok) {
            const html = await res.text();
            const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            
            let rawText = '';
            if (mainMatch) {
                rawText = mainMatch[1].replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
            } else if (bodyMatch) {
                rawText = bodyMatch[1].replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
            } else {
                rawText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
            }

            textSample = rawText.substring(0, 250);
            if (rawText.length > 250) textSample += '...';

            if (textSample.includes("No active") || !rawText) {
                textSample = "Currently checking. Please see Ontario Parks site for full details.";
                severity = 'info';
            } else {
                severity = 'warning';
            }
        }
    } catch (e) {
        console.error('[refresh-alerts] Failed to scrape Algonquin alerts.', e);
    }

    return {
        trip_id: TRIP_ID,
        title: 'Ontario Parks: Algonquin Backcountry',
        body: textSample,
        severity,
        source: 'Ontario Parks',
        is_active: true,
        created_at: new Date().toISOString()
    };
}

async function scrapeWeatherAlerts() {
    console.log('[refresh-alerts] Fetching EC ATOM feed...');
    const url = 'https://weather.gc.ca/rss/battleboard/onrm31_e.xml';
    
    let titleText = 'Weather Update';
    let summaryText = 'No details provided.';
    let severity = 'info';
    
    try {
        const res = await fetch(url, { next: { revalidate: 0 } });
        if (res.ok) {
            const xml = await res.text();
            const entryMatch = xml.match(/<entry[^>]*>([\s\S]*?)<\/entry>/i);
            if (entryMatch) {
                const entryXML = entryMatch[1];
                const titleMatch = entryXML.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || entryXML.match(/<atom:title[^>]*>([\s\S]*?)<\/atom:title>/i);
                if (titleMatch) titleText = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
                
                const summaryMatch = entryXML.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || entryXML.match(/<atom:summary[^>]*>([\s\S]*?)<\/atom:summary>/i);
                if (summaryMatch) summaryText = summaryMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
            }
        }
    } catch (e) {
        console.error('[refresh-alerts] Failed to scrape EC alerts.', e);
    }

    if (titleText.includes('No alerts in effect') || summaryText.includes('No alerts in effect')) {
        severity = 'info';
    } else if (titleText.toLowerCase().includes('warning')) {
        severity = 'critical';
    } else if (titleText.toLowerCase().includes('watch') || titleText.toLowerCase().includes('statement')) {
        severity = 'warning';
    }

    return {
        trip_id: TRIP_ID,
        title: 'Environment Canada',
        body: titleText,
        severity,
        source: 'Environment Canada',
        is_active: true,
        created_at: new Date().toISOString()
    };
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const algonquinAlert = await scrapeAlgonquinAlerts();
    const ecAlert = await scrapeWeatherAlerts();

    const alerts = [algonquinAlert, ecAlert];

    for (const alert of alerts) {
        // Delete old alert by source to deduplicate
        const { error: deleteErr } = await supabaseAdmin
            .from('alerts')
            .delete()
            .eq('trip_id', TRIP_ID)
            .eq('source', alert.source);

        if (deleteErr) {
            console.error(`[refresh-alerts] Failed to delete old ${alert.source} alerts:`, deleteErr.message);
        }

        // Insert new alert
        const { error: insertErr } = await supabaseAdmin
            .from('alerts')
            .insert(alert);

        if (insertErr) {
            console.error(`[refresh-alerts] Failed to insert ${alert.source} alert:`, insertErr.message);
        }
    }

    console.log('[refresh-alerts] ✅ Alerts updated successfully.');
    return NextResponse.json({
        ok: true,
        alerts_processed: alerts.length,
        timestamp: new Date().toISOString()
    });
}
