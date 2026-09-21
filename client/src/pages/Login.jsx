import { Link } from 'react-router-dom';

export default function Login() {
  return (
    <div className="site site-center">
      <main className="signin">
        <h1>Sign in to AI Capsule</h1>
        <a className="btn btn-primary btn-lg btn-block" href="/auth/github">Continue with GitHub</a>
        <Link className="signin-back" to="/">Back to home</Link>
      </main>
    </div>
  );
}
