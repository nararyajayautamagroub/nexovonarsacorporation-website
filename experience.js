(function(){
  var keys={language:"nx-language",theme:"nx-theme",motion:"nx-motion",refresh:"nx-refresh"};
  var defaults={theme:"dark",motion:true,refresh:true};

  function get(key,fallback){var value=localStorage.getItem(keys[key]);return value==null?fallback:value}
  function set(key,value){localStorage.setItem(keys[key],String(value))}
  function translate(value){return window.NX_I18N&&window.NX_I18N[value]||null}

  function apply(){
    var lang=window.NX_LANG||"id";
    var dict=translate(lang)||translate("id");
    var theme=get("theme",defaults.theme);
    var motion=get("motion",defaults.motion);
    document.documentElement.lang=lang;
    document.documentElement.dir=dict&&dict.dir||"ltr";
    document.documentElement.dataset.theme=theme;
    document.documentElement.dataset.motion=motion==="false"?"reduce":"full";
    if(window.NX_CONFIG&&window.NX_CONFIG.app)window.NX_CONFIG.app.defaultLanguage=lang;
  }

  function renderSettings(){
    var t=window.NX_T||function(x){return x};
    var languages=(window.NX_CONFIG&&window.NX_CONFIG.app&&window.NX_CONFIG.app.supportedLanguages||["id","en","ms","vi","th","zh","ja","ko","ar","es"]);
    var languageOptions=languages.map(function(code){
      var dict=window.NX_I18N[code];
      return '<option value="'+e(code)+'" '+(window.NX_LANG===code?"selected":"")+'>'+e((dict&&dict.label)||code)+'</option>';
    }).join("");
    var theme=get("theme",defaults.theme);
    var motion=get("motion",defaults.motion)==="true";
    var refresh=get("refresh",defaults.refresh)==="true";
    var user=window.NX_AUTH&&window.NX_AUTH.getUser();
    return H(t("nav.settings"),"NEXOVONARSA CORPORATION · Preferences, appearance and account",
      '<button class="btn" id="settingsAccount">'+e(user?t("common.account"):t("common.login"))+'</button>')+
      '<div class="grid settings-grid">'+
      C(t("common.appearance"),'<label class="setting-row"><span>'+e(t("common.language"))+'</span><select class="select" id="settingLanguage">'+languageOptions+'</select></label>'+
        '<label class="setting-row"><span>'+e(t("common.theme"))+'</span><select class="select" id="settingTheme"><option value="dark" '+(theme==="dark"?"selected":"")+'>'+e(t("common.dark"))+'</option><option value="light" '+(theme==="light"?"selected":"")+'>'+e(t("common.light"))+'</option><option value="system" '+(theme==="system"?"selected":"")+'>'+e(t("common.system"))+'</option></select></label>'+
        '<label class="setting-row check"><span>'+e(t("common.reducedMotion"))+'</span><input id="settingMotion" type="checkbox" '+(motion?"":"checked")+'></label>')+
      C(t("common.preferences"),'<label class="setting-row check"><span>'+e(t("common.autoRefresh"))+'</span><input id="settingRefresh" type="checkbox" '+(refresh?"checked":"")+'></label><div class="notice"><b>Data sync:</b> GitHub repository intelligence and public scraper snapshots are generated server-side by GitHub Actions. Browser settings do not expose credentials.</div>')+
      C(t("common.security"),'<div class="notice"><b>Authentication:</b> '+e(window.NX_AUTH&&window.NX_AUTH.isConfigured()?t("common.configured"):t("common.notConfigured"))+'<br><b>Provider:</b> Supabase Auth · Email/Password + Google OAuth.</div>')+
      '</div>';
  }

  function bindSettings(){
    var lang=document.getElementById("settingLanguage");
    var theme=document.getElementById("settingTheme");
    var motion=document.getElementById("settingMotion");
    var refresh=document.getElementById("settingRefresh");
    if(lang)lang.onchange=function(){
      var code=lang.value;
      localStorage.setItem(keys.language,code);
      window.NX_LANG=code;
      apply();
      if(typeof render==="function")render();
    };
    if(theme)theme.onchange=function(){set("theme",theme.value);apply()};
    if(motion)motion.onchange=function(){set("motion",motion.checked);apply()};
    if(refresh)refresh.onchange=function(){set("refresh",refresh.checked)};
    var account=document.getElementById("settingsAccount");
    if(account)account.onclick=function(){
      if(window.NX_AUTH){window.NX_AUTH.open(window.NX_AUTH.getUser()?"login":"login")}
    };
  }

  function header(){
    var user=document.querySelector("header .user");
    if(!user)return;
    var t=window.NX_T||function(x){return x};
    var account=window.NX_AUTH&&window.NX_AUTH.getUser();
    var displayName=t("common.login");
    if(account){
      var meta=account.user_metadata||{};
      displayName=meta.full_name||meta.name||account.email||"Account";
    }
    var avatar=account?(String(displayName).slice(0,1).toUpperCase()||"A"):"G";
    user.innerHTML='<button class="account-chip" id="accountChip" type="button"><span class="account-avatar">'+e(avatar)+'</span><span>'+e(displayName)+'</span></button>';
    var chip=document.getElementById("accountChip");
    if(chip)chip.onclick=function(){if(window.NX_AUTH)window.NX_AUTH.open(account?"login":"login")};
  }
  function localizeNav(){
    var t=window.NX_T||function(x){return x};
    document.querySelectorAll("#nav button").forEach(function(button){
      var key="common."+button.dataset.page;
      var value=window.NX_T&&window.NX_T("nav."+button.dataset.page);
      if(value)button.textContent=value;
    });
    var crumb=document.getElementById("crumb");
    if(crumb){
      var value=window.NX_T&&window.NX_T("nav."+P.page);
      crumb.textContent=value||P.page;
    }
  }

  function afterRender(){
    apply();
    localizeNav();
    header();
    if(P&&P.page==="settings")bindSettings();
  }

  function scheduleRefresh(){
    if(window.NX_REFRESH_TIMER)clearInterval(window.NX_REFRESH_TIMER);
    if(get("refresh",defaults.refresh)!=="true")return;
    var minutes=window.NX_CONFIG&&window.NX_CONFIG.app&&Number(window.NX_CONFIG.app.autoRefreshMinutes)||15;
    window.NX_REFRESH_TIMER=setInterval(function(){if(document.visibilityState==="visible")window.location.reload()},Math.max(1,minutes)*60000);
  }
  function start(){
    apply();
    if(navigator.serviceWorker&&window.isSecureContext){
      navigator.serviceWorker.register("./sw.js").catch(function(){});
    }
    scheduleRefresh();
    afterRender();
  }

  function afterAuth(){afterRender();scheduleRefresh()}

  function openSettings(){if(typeof P!=="undefined"){P.page="settings";if(typeof render==="function")render()}}

  window.NX_EXPERIENCE={start:start,afterRender:afterRender,afterAuth:afterAuth,renderSettings:renderSettings,openSettings:openSettings,apply:apply};
  function e(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}}[c]})}
})();
