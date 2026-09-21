import { Link } from 'react-router-dom';
import Brand from '../components/Brand.jsx';

export default function Home() {
  return (
    <div className="site">
      <header className="site-bar">
        <Brand />
        <Link className="btn btn-quiet" to="/login">Sign in</Link>
      </header>

      <main className="home">
        <section className="hero">
          <div className="hero-copy">
            <h1>Keep the prompts that worked.</h1>
            <p className="hero-lede">
              Save your AI prompts, every version of them, and what the AI said back.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/login">Sign in with GitHub</Link>
            </div>
          </div>

          <figure className="stack" aria-label="An example capsule saved in three versions">
            <div className="stack-sheet stack-v1" aria-hidden="true">
              <span className="stack-ver">v1</span>
              <span className="stack-title">Debug cloud deployment</span>
              <span className="pill pill-meh">Needs improvement</span>
            </div>
            <div className="stack-sheet stack-v2" aria-hidden="true">
              <span className="stack-ver">v2</span>
              <span className="stack-title">Debug cloud deployment</span>
              <span className="pill pill-meh">Needs improvement</span>
            </div>
            <article className="capsule capsule-demo">
              <div className="capsule-ver">v3</div>
              <div className="capsule-body">
                <header className="capsule-head">
                  <div>
                    <h3>Debug cloud deployment</h3>
                    <p className="capsule-where"><span>SmartFarm Irrigation</span><span>Coding</span></p>
                  </div>
                  <span className="pill pill-good">Good</span>
                </header>
                <blockquote className="capsule-prompt">
                  My Express app deploys to Azure but the page shows Application Error.
                  Here is the log stream output. What should I check first?
                </blockquote>
                <p className="capsule-resp">
                  <span className="k">AI response</span>
                  Check the start command, and read PORT from the environment instead of
                  hardcoding it.
                </p>
                <footer className="capsule-foot">
                  <ul className="marks">
                    <li className="yes">Reviewed</li>
                    <li className="yes">Improved</li>
                  </ul>
                </footer>
              </div>
            </article>
          </figure>
        </section>
      </main>
    </div>
  );
}
