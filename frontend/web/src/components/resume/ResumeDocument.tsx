import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ResumeData } from '../../types';

interface ResumeDocumentProps {
  data: ResumeData;
  onPages?: (totalPages: number) => void;
}

function cleanUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

function formatDates(start?: string | null, end?: string | null): string {
  const s = start?.trim();
  const e = end?.trim();
  if (s && e) {
    return `${s} – ${e}`;
  }
  return e || s || '';
}

const styles = StyleSheet.create({
  page: {
    size: 'A4',
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    color: '#111111',
  },
  // Header
  headerName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 3,
  },
  headerSub: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 6,
  },
  headerLink: {
    color: '#333333',
    textDecoration: 'none',
  },
  // Section Headings
  sectionHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#1F3A5F',
    marginTop: 10,
    paddingBottom: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: '#1F3A5F',
    marginBottom: 5,
  },
  // Entries
  entryContainer: {
    marginBottom: 4,
  },
  entryFirstLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  entryTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    flex: 1,
  },
  entryDates: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: '#333333',
    textAlign: 'right',
  },
  entrySecondLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9.5,
    color: '#333333',
    marginTop: 0.5,
    marginBottom: 1.5,
  },
  entrySubtitle: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9.5,
    color: '#333333',
    flex: 1,
  },
  entryScore: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9.5,
    color: '#333333',
    textAlign: 'right',
  },
  // Bullets
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 1.5,
  },
  bulletDot: {
    width: 10,
    fontSize: 9.5,
    lineHeight: 1.35,
    fontFamily: 'Helvetica',
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.35,
    fontFamily: 'Helvetica',
  },
  // Skills
  skillLine: {
    fontSize: 9.5,
    lineHeight: 1.35,
    marginBottom: 2,
  },
  skillCategory: {
    fontFamily: 'Helvetica-Bold',
  },
  skillItems: {
    fontFamily: 'Helvetica',
  },
  // Summary
  summaryText: {
    fontSize: 9.5,
    lineHeight: 1.35,
    fontFamily: 'Helvetica',
  },
});

export function ResumeDocument({ data, onPages }: ResumeDocumentProps) {
  const basics = data?.basics || { name: 'Candidate', email: '', links: [] };
  const name = basics.name || 'Candidate';

  // Build header items separated by "  |  "
  const headerParts: Array<{ text: string; url?: string }> = [];
  if (basics.email) headerParts.push({ text: basics.email });
  if (basics.phone) headerParts.push({ text: basics.phone });
  if (basics.location) headerParts.push({ text: basics.location });
  if (basics.links && basics.links.length > 0) {
    basics.links.forEach((link) => {
      if (link.url) {
        headerParts.push({ text: cleanUrl(link.url), url: link.url });
      }
    });
  }

  const hasSummary = Boolean(data.summary && data.summary.trim());
  const hasEducation = Boolean(data.education && data.education.length > 0);
  const hasSkills = Boolean(data.skills && data.skills.length > 0);
  const hasExperience = Boolean(data.experience && data.experience.length > 0);
  const hasProjects = Boolean(data.projects && data.projects.length > 0);
  const hasCertifications = Boolean(data.certifications && data.certifications.length > 0);

  return (
    <Document title={`${name} - Resume`} author={name}>
      <Page size="A4" style={styles.page}>
        {/* Page counter helper */}
        <Text
          fixed
          render={({ totalPages }) => {
            if (onPages) {
              queueMicrotask(() => onPages(totalPages));
            }
            return null;
          }}
        />

        {/* Header */}
        <Text style={styles.headerName}>{name}</Text>
        {headerParts.length > 0 && (
          <Text style={styles.headerSub}>
            {headerParts.map((part, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && '  |  '}
                {part.url ? (
                  <Link src={part.url} style={styles.headerLink}>
                    {part.text}
                  </Link>
                ) : (
                  part.text
                )}
              </React.Fragment>
            ))}
          </Text>
        )}

        {/* 1. Summary (only if present) */}
        {hasSummary && (
          <View wrap={false} style={styles.entryContainer}>
            <Text style={styles.sectionHeading}>Summary</Text>
            <Text style={styles.summaryText}>{data.summary?.trim()}</Text>
          </View>
        )}

        {/* 2. Education */}
        {hasEducation && (
          <View style={styles.entryContainer}>
            <Text style={styles.sectionHeading}>Education</Text>
            {data.education.map((edu, idx) => {
              const dates = formatDates(edu.start, edu.end);
              const sub = edu.location ? `${edu.institution}, ${edu.location}` : edu.institution;
              return (
                <View key={idx} wrap={false} style={styles.entryContainer}>
                  <View style={styles.entryFirstLine}>
                    <Text style={styles.entryTitle}>{edu.degree}</Text>
                    {dates ? <Text style={styles.entryDates}>{dates}</Text> : null}
                  </View>
                  <View style={styles.entrySecondLine}>
                    <Text style={styles.entrySubtitle}>{sub}</Text>
                    {edu.score ? <Text style={styles.entryScore}>{edu.score}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 3. Skills */}
        {hasSkills && (
          <View style={styles.entryContainer}>
            <Text style={styles.sectionHeading}>Skills</Text>
            {data.skills.map((group, idx) => (
              <Text key={idx} wrap={false} style={styles.skillLine}>
                <Text style={styles.skillCategory}>{group.category}: </Text>
                <Text style={styles.skillItems}>{group.items.join(', ')}</Text>
              </Text>
            ))}
          </View>
        )}

        {/* 4. Experience */}
        {hasExperience && (
          <View style={styles.entryContainer}>
            <Text style={styles.sectionHeading}>Experience</Text>
            {data.experience.map((exp, idx) => {
              const dates = formatDates(exp.start, exp.end);
              const sub = exp.location ? `${exp.company}, ${exp.location}` : exp.company;
              return (
                <View key={idx} wrap={false} style={styles.entryContainer}>
                  <View style={styles.entryFirstLine}>
                    <Text style={styles.entryTitle}>{exp.role}</Text>
                    {dates ? <Text style={styles.entryDates}>{dates}</Text> : null}
                  </View>
                  <View style={styles.entrySecondLine}>
                    <Text style={styles.entrySubtitle}>{sub}</Text>
                  </View>
                  {exp.bullets.map((b, bIdx) => (
                    <View key={bIdx} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* 5. Projects */}
        {hasProjects && (
          <View style={styles.entryContainer}>
            <Text style={styles.sectionHeading}>Projects</Text>
            {data.projects.map((proj, idx) => {
              const techStr = proj.tech ? proj.tech.join(', ') : '';
              return (
                <View key={idx} wrap={false} style={styles.entryContainer}>
                  <View style={styles.entryFirstLine}>
                    <Text style={styles.entryTitle}>{proj.name}</Text>
                    {proj.url ? (
                      <Link src={proj.url} style={styles.headerLink}>
                        <Text style={styles.entryDates}>{cleanUrl(proj.url)}</Text>
                      </Link>
                    ) : null}
                  </View>
                  {techStr ? (
                    <View style={styles.entrySecondLine}>
                      <Text style={styles.entrySubtitle}>{techStr}</Text>
                    </View>
                  ) : null}
                  {proj.bullets.map((b, bIdx) => (
                    <View key={bIdx} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* 6. Certifications */}
        {hasCertifications && (
          <View style={styles.entryContainer}>
            <Text style={styles.sectionHeading}>Certifications</Text>
            {data.certifications.map((cert, idx) => (
              <View key={idx} wrap={false} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{cert}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export default ResumeDocument;
