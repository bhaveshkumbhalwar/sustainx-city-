import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/ui/Icon';
import { useFetch } from '../../hooks/useFetch';
import { getDashboardStats } from '../../services/api';

const FEATURES = [
  { icon: 'map-pin', title: 'Citizen Reporting', desc: 'Report waste, overflowing bins and illegal dumping in seconds with photo proof.' },
  { icon: 'trash', title: 'Smart Bins', desc: 'IoT-enabled bins report fill levels and alert crews before overflow happens.' },
  { icon: 'cpu', title: 'AI Waste Intelligence', desc: 'Predictions and hotspot insights support a data-driven municipal response.' },
  { icon: 'truck', title: 'Collection Operations', desc: 'Collectors get prioritized tasks, routes and GPS-tracked proof of collection.' },
  { icon: 'chart', title: 'Municipal Analytics', desc: 'SLA view, ward performance and complaint trends in one control room.' },
  { icon: 'recycle', title: 'Rewards & Impact', desc: 'Citizens earn points that convert into useful eco-friendly items.' },
];

const LOOP = [
  { icon: 'user', title: 'Citizen / IoT', desc: 'Reports and sensor data enter the system' },
  { icon: 'cpu', title: 'AI + Analytics', desc: 'Risk, priority and hotspots identified' },
  { icon: 'shield', title: 'Control Room', desc: 'Operations teams monitor city-wide' },
  { icon: 'truck', title: 'Collection', desc: 'Collector + vehicle dispatched with GPS proof' },
  { icon: 'chart', title: 'Continuous Improvement', desc: 'Outcomes feed back into planning' },
];

function Hero() {
  const { user } = useAuth();
  const { data: stats } = useFetch(getDashboardStats);
  const total = stats?.total ?? null;

  return (
    <section className="landing-hero">
      <div className="landing-hero-glow" aria-hidden="true" />
      <div className="landing-hero-inner">
        <div className="landing-hero-copy">
          <span className="landing-chip"><Icon name="zap" size={14} /> Smart City Waste Intelligence</span>
          <h1 className="landing-hero-title">
            One platform for <span className="text-accent">cleaner cities</span>.
          </h1>
          <p className="landing-hero-sub">
            SustainX connects citizens, smart bins, AI intelligence and municipal
            operations into one closed-loop waste-management platform.
          </p>
          <div className="landing-hero-cta">
            <Link to="/login" className="btn btn-primary btn-lg">
              {user ? 'Open Dashboard' : 'Report Waste Now'}
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">Sign In for Staff</Link>
          </div>
          <div className="landing-mini-stats">
            <div className="mini-stat">
              <div className="mini-stat-value">{total !== null ? total : '—'}</div>
              <div className="mini-stat-label">Complaints tracked</div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat-value">5</div>
              <div className="mini-stat-label">Operational wards</div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat-value">IoT</div>
              <div className="mini-stat-label">Live bin monitoring</div>
            </div>
          </div>
        </div>
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="hero-panel hero-panel-main">
            <div className="hero-panel-head">
              <span className="hero-pulse" /> <strong>Control Room</strong> <span className="hero-live">LIVE</span>
            </div>
            <div className="hero-kpis">
              <div className="hero-kpi"><span className="hero-kpi-value">42</span><span className="hero-kpi-label">Open</span></div>
              <div className="hero-kpi"><span className="hero-kpi-value">8</span><span className="hero-kpi-label">Critical</span></div>
              <div className="hero-kpi"><span className="hero-kpi-value">93%</span><span className="hero-kpi-label">SLA</span></div>
            </div>
            <div className="hero-bars">
              {[3, 6, 4, 8, 5, 7, 9, 6, 8, 4, 7, 5].map((h, i) => (
                <div key={i} className="hero-bar" style={{ height: `${h * 10}%` }} />
              ))}
            </div>
          </div>
          <div className="hero-panel hero-panel-side">
            <div className="hero-chip hero-chip-danger"><span className="badge-dot-danger" /> Bin RS-104 — Overflow risk</div>
            <div className="hero-chip hero-chip-warn"><span className="badge-dot-warn" /> Ward C — Hotspot rising</div>
            <div className="hero-chip hero-chip-ok"><span className="badge-dot-ok" /> Complaints resolved +12% today</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, sub }) {
  return (
    <div className="landing-section-head">
      {eyebrow && <span className="landing-eyebrow">{eyebrow}</span>}
      <h2 className="landing-section-title">{title}</h2>
      {sub && <p className="landing-section-sub">{sub}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <Hero />

      <section className="landing-section landing-section-band">
        <div className="landing-container">
          <SectionHeading
            eyebrow="The problem"
            title="Waste is a logistics and intelligence problem, not just a cleanup problem"
            sub="A city needs to know what is waste, where it is building up, who should act and by when. SustainX digitizes that loop."
          />
          <div className="problem-cards">
            {[
              { icon: 'alert-triangle', title: 'Unpredictable overflow', desc: 'Without bin sensors, crews react after the mess is reported.' },
              { icon: 'map-pin', title: 'Fragmented reporting', desc: 'Citizens and departments use disconnected channels with no shared status.' },
              { icon: 'chart', title: 'No operational visibility', desc: 'Officials lack ward-level views of pending work, S LA and performance.' },
            ].map((c) => (
              <div className="problem-card" key={c.title}>
                <div className="problem-card-icon"><Icon name={c.icon} size={22} /></div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <SectionHeading
            eyebrow="How it works"
            title="A closed loop from report to resolution"
            sub="Citizens and sensors feed data; intelligence prioritizes it; municipal teams act on it; results close the loop."
          />
          <div className="loop-flow">
            {LOOP.map((s, i) => (
              <div className="loop-step" key={s.title}>
                <div className="loop-step-icon"><Icon name={s.icon} size={20} /></div>
                <div className="loop-step-num">{String(i + 1).padStart(2, '0')}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="split">
            <div className="split-copy">
              <SectionHeading
                eyebrow="Smart bins"
                title="Bins that tell you when they will be full"
                sub="IoT sensors report fill level, temperature and connectivity. Crews and control rooms see observed data side by side with clearly-marked estimates."
              />
              <div className="bin-meter">
                <div className="bin-meter-row">
                  <span className="bin-meter-label">Observed fill</span>
                  <div className="progress-track">
                    <div className="progress-fill progress-fill-warning" style={{ width: '72%' }} />
                  </div>
                  <span className="bin-meter-value">72%</span>
                </div>
                <div className="bin-meter-row">
                  <span className="bin-meter-label">Predicted fill (est.)</span>
                  <div className="progress-track">
                    <div className="progress-fill progress-fill-danger" style={{ width: '86%' }} />
                  </div>
                  <span className="bin-meter-value">86%</span>
                </div>
              </div>
              <p className="landing-note">Observed data is real sensor output. Predictions are estimates, never presented as readings.</p>
            </div>
            <div className="split-visual">
              <div className="mini-scoreboard">
                <div className="score-item"><span className="score-dot score-dot-green" /> 38 bins normal</div>
                <div className="score-item"><span className="score-dot score-dot-amber" /> 9 bins getting full</div>
                <div className="score-item"><span className="score-dot score-dot-red" /> 3 bins overflow risk</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <SectionHeading
            eyebrow="Platform"
            title="Built for every actor in the waste ecosystem"
          />
          <div className="role-grid">
            {[
              { icon: 'user', title: 'Citizens', desc: 'Report in seconds, track status, earn rewards.' },
              { icon: 'truck', title: 'Collection Officers', desc: 'Prioritized tasks, bin alerts, GPS photo proof.' },
              { icon: 'shield', title: 'Ward & Zone Officers', desc: 'Live operations and SLA on their geography.' },
              { icon: 'chart', title: 'Municipal Administrators', desc: 'Control room, analytics and user management.' },
              { icon: 'cpu', title: 'AI-Powered Insights', desc: 'Overflow risk, hotspot trends, recommendations.' },
              { icon: 'map', title: 'GIS Operations', desc: 'A city map linking bins, complaints and crews.' },
            ].map((r) => (
              <div className="role-card" key={r.title}>
                <div className="role-card-icon"><Icon name={r.icon} size={20} /></div>
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-band">
        <div className="landing-container">
          <div className="cta-block">
            <h2>Ready to see SustainX in action?</h2>
            <p>Sign in as a citizen, field officer or administrator to explore your workspace.</p>
            <div className="landing-hero-cta">
              <Link to="/login" className="btn btn-primary btn-lg">Get Started</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}