'use client';

import React from 'react';
import type { CrewMember } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';

interface CrewRosterCardProps {
    crew: CrewMember[];
}

const canoeColors = ['#C9A455', '#4CAF95', '#7B9BD0'];

export default function CrewRosterCard({ crew }: CrewRosterCardProps) {
    const canoeGroups = crew.reduce<Record<number, CrewMember[]>>((acc, m) => {
        if (!acc[m.canoe_number]) acc[m.canoe_number] = [];
        acc[m.canoe_number].push(m);
        return acc;
    }, {});

    return (
        <GlassCard className="crew-card">
            <SectionHeader title="Crew Roster" icon="🧑‍🤝‍🧑" subtitle={`${crew.length} paddlers`} />

            {Object.entries(canoeGroups).map(([canoeNum, members]) => (
                <div key={canoeNum} className="crew-card__canoe">
                    <div
                        className="crew-card__canoe-header"
                        style={{ borderColor: canoeColors[parseInt(canoeNum) - 1] }}
                    >
                        <span>🛶 Canoe {canoeNum}</span>
                    </div>
                    {members.map((member) => (
                        <div key={member.id} className="crew-card__member">
                            <div className="crew-card__member-avatar">
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="crew-card__member-info">
                                <p className="crew-card__member-name">{member.name}</p>
                                <p className="crew-card__member-role">{member.role}</p>
                                {member.notes && (
                                    <p className="crew-card__member-notes">{member.notes}</p>
                                )}
                            </div>
                            <div className="crew-card__member-load">
                                <p className="crew-card__load-item">{member.load_item}</p>
                                <p className="crew-card__load-weight">{member.load_weight_kg} kg</p>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </GlassCard>
    );
}
