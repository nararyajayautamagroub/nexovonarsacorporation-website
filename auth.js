(function(){
  var client=null;
  var state={user:null,session:null,configured:false};

  function configured(){
    var cfg=window.NX_CONFIG&&window.NX_CONFIG.supabase||{};
    var validUrl=false;
    try{validUrl=new URL(cfg.url).protocol==="https:";}catch(error){validUrl=false}
    return validUrl && !!cfg.publishableKey && !/^YOUR_/i.test(cfg.publishableKey) && !/service_role/i.test(cfg.publishableKey);
  }

  function getRedirect(){
    return window.NX_CONFIG&&window.NX_CONFIG.auth&&window.NX_CONFIG.auth.redirectTo ||
      window.location.origin+window.location.pathname;
  }

  function init(){
    state.configured=configured() && !!window.supabase && !!window.supabase.createClient;
    if(state.configured){
      client=window.supabase.createClient(
        window.NX_CONFIG.supabase.url,
        window.NX_CONFIG.supabase.publishableKey,
        {auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}
      );
      client.auth.getSession().then(function(result){
        state.session=result.data&&result.data.session||null;
        state.user=state.session&&state.session.user||null;
        render();
      }).catch(function(error){showMessage(error.message,false)});
      client.auth.onAuthStateChange(function(event,session){
        state.session=session||null;
        state.user=session&&session.user||null;
        render();
        if(window.NX_EXPERIENCE&&window.NX_EXPERIENCE.afterAuth) window.NX_EXPERIENCE.afterAuth(event,state.user);
      });
    }
    return state;
  }

  function message(text,ok){
    var el=document.getElementById("authMessage");
    if(!el)return;
    el.textContent=text||"";
    el.dataset.type=ok?"success":"error";
    el.classList.toggle("show",!!text);
  }

  function showMessage(text,ok){message(text,ok!==false)}

  function mount(){
    if(document.getElementById("authModal"))return;
    var div=document.createElement("div");
    div.id="authModal";
    div.className="modal auth-modal";
    div.setAttribute("aria-hidden","true");
    div.innerHTML='<div class="modalbox auth-box" role="dialog" aria-modal="true" aria-labelledby="authTitle">'+
      '<div class="modaltop"><div><div class="eyebrow">NEXOVONARSA ACCOUNT</div><h1 id="authTitle">Akun</h1><p id="authSubtitle">Masuk, daftar, atau kelola sesi Anda.</p></div>'+
      '<button class="close" id="authClose" type="button" aria-label="Close">×</button></div>'+
      '<div id="authBody"></div>'+
      '</div>';
    document.body.appendChild(div);
    document.getElementById("authClose").onclick=close;
    div.addEventListener("click",function(ev){if(ev.target===div)close()});
  }

  function open(mode){
    mount();
    var modal=document.getElementById("authModal");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden","false");
    modal.dataset.mode=mode||"login";
    render();
  }

  function close(){
    var modal=document.getElementById("authModal");
    if(modal){modal.classList.remove("show");modal.setAttribute("aria-hidden","true")}
  }

  function profileName(user){
    if(!user)return "";
    return user.user_metadata&&(
      user.user_metadata.full_name||
      user.user_metadata.name||
      user.user_metadata.display_name
    )||user.email||"Account";
  }

  function render(){
    mount();
    var body=document.getElementById("authBody");
    if(!body)return;
    if(state.user){
      var meta=state.user.user_metadata||{};
      var t2=window.NX_T||function(x){return x};
      body.innerHTML='<div class="account-profile">'+
        '<div class="avatar">'+e(profileName(state.user).slice(0,1).toUpperCase())+'</div>'+
        '<div><strong>'+e(profileName(state.user))+'</strong><small>'+e(state.user.email||"")+'</small></div>'+
      '</div>'+
      '<div class="auth-stack">'+
        '<label><span>'+e(t2("common.name"))+'</span><input id="authProfileName" value="'+e(meta.full_name||meta.name||"")+'" maxlength="80" autocomplete="name"></label>'+
        '<label><span>'+e(t2("common.email"))+'</span><input value="'+e(state.user.email||"")+'" disabled></label>'+
        '<label><span>'+e(t2("common.newPassword"))+'</span><input id="authNewPassword" type="password" minlength="8" autocomplete="new-password"></label>'+
      '</div>'+
      '<div class="auth-actions"><button class="btn primary" id="authSaveProfile">'+e(t2("common.save"))+'</button><button class="btn" id="authResend">'+e(t2("common.resendVerification"))+'</button><button class="btn" id="authLogout">'+e(t2("common.logout"))+'</button><button class="btn" id="authAccountSettings">'+e(t2("common.settings"))+'</button></div>'+
      '<div id="authMessage" class="auth-message"></div>';
      document.getElementById("authLogout").onclick=logout;
      document.getElementById("authAccountSettings").onclick=function(){close();if(window.NX_EXPERIENCE)window.NX_EXPERIENCE.openSettings()};
      document.getElementById("authSaveProfile").onclick=saveProfile;
      document.getElementById("authResend").onclick=resendVerification;
      return;
    }
    var mode=document.getElementById("authModal").dataset.mode||"login";
    var t=window.NX_T||function(x){return x};
    body.innerHTML='<div class="auth-tabs"><button type="button" class="btn '+(mode==="login"?"active":"")+'" id="authLoginTab">'+e(t("common.login"))+'</button><button type="button" class="btn '+(mode==="register"?"active":"")+'" id="authRegisterTab">'+e(t("common.register"))+'</button></div>'+
      '<form id="authForm" class="auth-form" novalidate>'+
      (mode==="register"?'<label><span>'+e(t("common.name"))+'</span><input id="authName" autocomplete="name" maxlength="80" required></label>':"")+
      '<label><span>'+e(t("common.email"))+'</span><input id="authEmail" type="email" autocomplete="email" inputmode="email" required></label>'+
      '<label><span>'+e(t("common.password"))+'</span><input id="authPassword" type="password" autocomplete="'+(mode==="register"?"new-password":"current-password")+'" minlength="8" required></label>'+
      '<button class="btn primary auth-submit" type="submit">'+e(mode==="login"?t("common.login"):t("common.register"))+'</button>'+
      '<button class="btn google-btn" type="button" id="authGoogle">'+e(t("common.google"))+'</button>'+
      '<button class="link-btn" type="button" id="authForgot">'+e(t("common.forgot"))+'</button>'+
      '<div id="authMessage" class="auth-message"></div></form>';

    document.getElementById("authLoginTab").onclick=function(){open("login")};
    document.getElementById("authRegisterTab").onclick=function(){open("register")};
    document.getElementById("authForm").onsubmit=function(ev){ev.preventDefault();mode==="login"?login():register()};
    document.getElementById("authGoogle").onclick=google;
    document.getElementById("authForgot").onclick=resetPassword;
    message(state.configured?"":"Supabase Auth belum siap. Periksa config.js dan koneksi CDN Supabase sebelum mengaktifkan akun.",false);
  }

  async function login(){
    if(!client){message("Auth belum dikonfigurasi.",false);return}
    var email=document.getElementById("authEmail").value.trim();
    var password=document.getElementById("authPassword").value;
    message(window.NX_T?window.NX_T("common.loading"):"Loading...",true);
    var result=await client.auth.signInWithPassword({email:email,password:password});
    if(result.error)message(result.error.message,false);else message("Login berhasil.",true);
  }

  async function register(){
    if(!client){message("Auth belum dikonfigurasi.",false);return}
    var name=document.getElementById("authName").value.trim();
    var email=document.getElementById("authEmail").value.trim();
    var password=document.getElementById("authPassword").value;
    if(password.length<8){message("Password minimal 8 karakter.",false);return}
    message(window.NX_T?window.NX_T("common.loading"):"Loading...",true);
    var result=await client.auth.signUp({
      email:email,password:password,
      options:{data:{full_name:name,name:name},emailRedirectTo:getRedirect()}
    });
    if(result.error)message(result.error.message,false);
    else message(result.data&&result.data.session?"Registrasi berhasil.":"Registrasi berhasil. Periksa email untuk verifikasi.",true);
  }

  async function google(){
    if(!client){message("Auth belum dikonfigurasi.",false);return}
    var result=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:getRedirect()}});
    if(result.error)message(result.error.message,false);
  }

  async function resetPassword(){
    if(!client){message("Auth belum dikonfigurasi.",false);return}
    var email=document.getElementById("authEmail")&&document.getElementById("authEmail").value.trim();
    if(!email){message("Masukkan email terlebih dahulu.",false);return}
    var result=await client.auth.resetPasswordForEmail(email,{redirectTo:getRedirect()});
    if(result.error)message(result.error.message,false);else message("Link reset password telah dikirim jika email valid.",true);
  }

  async function saveProfile(){
    if(!client||!state.user){message("Login required.",false);return}
    var name=document.getElementById("authProfileName").value.trim();
    var password=document.getElementById("authNewPassword").value;
    if(name.length<1||name.length>80){message("Name must contain 1-80 characters.",false);return}
    if(password&&password.length<8){message("Password must contain at least 8 characters.",false);return}
    var update={data:{full_name:name,name:name}};
    if(password)update.password=password;
    var result=await client.auth.updateUser(update);
    if(result.error)message(result.error.message,false);else{
      message(password?"Profile and password updated.":"Profile updated.",true);
      var input=document.getElementById("authNewPassword");if(input)input.value="";
    }
  }

  async function resendVerification(){
    if(!client||!state.user||!state.user.email){message("Verification email is unavailable.",false);return}
    var result=await client.auth.resend({
      type:"signup",
      email:state.user.email,
      options:{emailRedirectTo:getRedirect()}
    });
    if(result.error)message(result.error.message,false);else message("Verification email request sent.",true);
  }

  async function logout(){
    if(client)await client.auth.signOut();
    close();
  }

  window.NX_AUTH={
    init:init,
    open:open,
    close:close,
    logout:logout,
    getUser:function(){return state.user},
    isConfigured:function(){return state.configured},
    tState:function(){return state}
  };
  mount();
  init();
  function e(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
})();
