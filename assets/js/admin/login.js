import { supabase } from '../db.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';
import { isAdminUser, param, errMsg } from './common.js';

const app = document.getElementById('app');
const sb = await supabase();
let mode = location.hash.includes('type=recovery') ? 'reset' : 'signin';
let notice = param('out') ? ['You have been logged out.', false] : param('denied') ? ['That account is not on the admin list. Ask an existing admin to add your email in Settings.', true] : null;

function go() {
  const next = param('next');
  location.replace(siteUrl('admin/' + (next && /^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(next) ? next : 'index.html')));
}

const TITLES = { signin: 'Log in', signup: 'Create your admin password', forgot: 'Reset your password', reset: 'Choose a new password' };
function render() {
  app.innerHTML = `<div class="login">
    <section class="login__art" aria-hidden="true"><img src="${esc(siteUrl('assets/img/hero.jpg'))}" alt="">
      <div class="card"><strong style="letter-spacing:.18em;text-transform:uppercase">Grassroot Archives</strong><span class="serif" style="font-size:22px;line-height:1.35">Archive admin: river basins, stories and pages.</span></div></section>
    <div class="login__form"><form novalidate>
      <span class="eyebrow">Admin · CMS</span>
      <h1 class="display" style="font-size:44px">${TITLES[mode]}</h1>
      ${notice ? `<div class="notice${notice[1] ? ' is-error' : ''}" role="status">${esc(notice[0])}</div>` : ''}
      ${mode !== 'reset' ? `<label class="field"><span>Email</span><input type="email" name="email" autocomplete="username" required></label>` : ''}
      ${mode !== 'forgot' ? `<label class="field"><span>Password${mode === 'signin' ? '' : ' (at least 10 characters)'}</span>
        <span style="display:flex;border:1px solid var(--line-2);background:var(--surface)"><input type="password" name="password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" required minlength="${mode === 'signin' ? 1 : 10}" style="border:0;flex:1;min-width:0">
        <button type="button" class="btn btn--small btn--quiet" data-show style="border:0;border-left:1px solid var(--line)">Show</button></span></label>` : ''}
      <button class="btn btn--primary" type="submit">${{ signin: 'Log in', signup: 'Create password', forgot: 'Send reset link', reset: 'Save new password' }[mode]}</button>
      <div style="display:flex;flex-wrap:wrap;gap:16px">
        ${mode === 'signin' ? `<a href="#" data-mode="forgot">Forgot password?</a><a href="#" data-mode="signup">First time here? Create your password</a>` : `<a href="#" data-mode="signin">← Back to log in</a>`}
      </div>
      <p class="muted" style="margin:0">Only email addresses on the admin list can use the admin.</p>
      <a href="${esc(siteUrl('index.html'))}" class="muted">← Back to the public site</a>
    </form></div></div>`;
  const form = app.querySelector('form');
  app.querySelectorAll('[data-mode]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); mode = a.dataset.mode; notice = null; render(); }));
  app.querySelector('[data-show]')?.addEventListener('click', e => { const i = form.password; i.type = i.type === 'password' ? 'text' : 'password'; e.target.textContent = i.type === 'password' ? 'Show' : 'Hide'; });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.email?.value.trim().toLowerCase(), password = form.password?.value;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error;
        if (!(await isAdminUser(sb, email))) { await sb.auth.signOut(); throw new Error('That account is not on the admin list.'); }
        go(); return;
      }
      if (mode === 'signup') {
        if ((password || '').length < 10) throw new Error('Use at least 10 characters.');
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: siteUrl('admin/login.html') } }); if (error) throw error;
        if (data.session) { if (await isAdminUser(sb, email)) { go(); return; } await sb.auth.signOut(); throw new Error('Password created, but that email is not on the admin list.'); }
        notice = ['Check your inbox: click the confirmation link, then log in here.', false]; mode = 'signin';
      } else if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl('admin/login.html') }); if (error) throw error;
        notice = ['If that address has an account, a reset link is on its way.', false]; mode = 'signin';
      } else if (mode === 'reset') {
        if ((password || '').length < 10) throw new Error('Use at least 10 characters.');
        const { error } = await sb.auth.updateUser({ password }); if (error) throw error;
        history.replaceState(null, '', location.pathname); go(); return;
      }
    } catch (err) { notice = [errMsg(err), true]; }
    render();
  });
  form.querySelector('input')?.focus();
}

sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { mode = 'reset'; notice = null; render(); } });
const { data: { session } } = await sb.auth.getSession();
if (session && mode === 'signin' && !param('out') && await isAdminUser(sb, session.user.email)) go(); else render();
