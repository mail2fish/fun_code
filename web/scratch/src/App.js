import React from 'react';
import {compose} from 'redux';
import GUI ,{AppStateHOC} from 'scratch-gui';
// import 'scratch-gui/dist/scratch-gui.css';
import './App.css';

// import storage from './storage';

// session reducer - 参考 render-gui.jsx 的实现
const sessionReducer = (state = {
    session: {
        user: {
            username: '',
            nickname: '',
            token: '',
            classroomId: '',
            thumbnailUrl: null
        }
    },
    permissions: {
        educator: false,
        student: false
    }
}, action) => {
    switch (action.type) {
        case 'SET_SESSION_USER':
            return {
                ...state,
                session: {
                    ...state.session,
                    user: {
                        ...state.session.user,
                        ...action.payload
                    }
                }
            };
        case 'SET_SESSION_PERMISSIONS':
            return {
                ...state,
                permissions: {
                    ...state.permissions,
                    ...action.payload
                }
            };
        default:
            return state;
    }
};

// 定义自定义中文翻译
const customTranslations = {
    'gui.accountMenu.myStuff': '我的作品',
    'gui.accountMenu.myClasses': '我的班级',
    'gui.accountMenu.profile': '个人资料',
    // 可以在这里添加更多需要覆盖的翻译
};

// 创建自定义的 locales 初始状态，在页面显示前就注入翻译
const createCustomLocalesInitialState = () => {
    try {
        // 导入原始的 locales initial state
        const {localesInitialState} = require('scratch-gui/src/reducers/locales');
        
        console.log('🌐 正在创建自定义locales初始状态');
        console.log('🔍 原始messagesByLocale keys:', Object.keys(localesInitialState.messagesByLocale));
        
        // 创建包含自定义翻译的新 messagesByLocale
        const customMessagesByLocale = { ...localesInitialState.messagesByLocale };
        
        // 只为中文语言添加自定义翻译
        const chineseLocales = ['zh-cn', 'zh-tw', 'zh'];
        chineseLocales.forEach(locale => {
            if (customMessagesByLocale[locale]) {
                console.log(`📝 为中文语言 ${locale} 添加自定义翻译`);
                customMessagesByLocale[locale] = {
                    ...customMessagesByLocale[locale],
                    ...customTranslations
                };
            }
        });
        
        // 检测当前语言并设置对应的 messages
        // 使用简单的语言检测，fallback 到 en
        const browserLang = navigator.language || navigator.userLanguage || 'en';
        let currentLocale = 'en';
        
        if (browserLang.startsWith('zh')) {
            currentLocale = browserLang.includes('TW') || browserLang.includes('HK') ? 'zh-tw' : 'zh-cn';
        } else {
            currentLocale = browserLang.split('-')[0];
        }
        
        // 确保 locale 存在于 messagesByLocale 中
        if (!customMessagesByLocale[currentLocale]) {
            currentLocale = 'en';
        }
        
        console.log('🔍 检测到的语言:', currentLocale);
        console.log('✅ 自定义翻译已注入到初始状态');
        
        return {
            ...localesInitialState,
            locale: currentLocale,
            messagesByLocale: customMessagesByLocale,
            messages: customMessagesByLocale[currentLocale] || customMessagesByLocale.en
        };
        
    } catch (error) {
        console.error('❌ 创建自定义locales初始状态失败:', error);
        console.log('⚠️ 回退到简单的翻译注入方案');
        
        // 回退方案：返回简单的自定义翻译状态
        return {
            isRtl: false,
            locale: 'zh-cn',
            messagesByLocale: {
                'en': {}, // 英文保持空，使用默认翻译
                'zh-cn': customTranslations, // 只为中文提供自定义翻译
                'zh-tw': customTranslations
            },
            messages: customTranslations
        };
    }
};

// 创建带 session 的 AppStateHOC - 参考 render-gui.jsx 的实现
const AppStateHOCWithSession = (WrappedComponent) => {
    // 创建自定义的 locales 初始状态
    const customLocalesState = createCustomLocalesInitialState();
    
    const AppStateWithSession = AppStateHOC(
        WrappedComponent,
        false, // 不是 localesOnly
        { session: sessionReducer }, // 额外的 reducers
        { 
            session: undefined, // session 初始状态
            locales: customLocalesState // 自定义的 locales 初始状态
        }
    );
    
    // 简化的包装器，只保留必要的调试功能
    class SessionWrapper extends React.Component {
        componentDidMount() {
            // 从配置中获取用户信息并设置到 session
            const config = getConfig();
            
            // AppStateHOC 已经暴露了 store，添加调试功能
            setTimeout(() => {
                if (window._reduxStore) {
                    // 设置初始用户信息
                    if (config.username || config.nickname) {
                        window._reduxStore.dispatch({
                            type: 'SET_SESSION_USER',
                            payload: { 
                                username: config.username || 'Guest',
                                nickname: config.nickname || '',
                                token: (config.username || config.nickname) ? 'session-token' : ''
                            }
                        });
                        
                        console.log('👤 用户信息已初始化:', {
                            username: config.username || 'Guest',
                            nickname: config.nickname || ''
                        });
                    }
                    
                    // 验证自定义翻译是否已生效
                    const state = window._reduxStore.getState();
                    const myStuffMsg = state.locales.messages['gui.accountMenu.myStuff'];
                    console.log('🔍 验证初始翻译 gui.accountMenu.myStuff:', myStuffMsg);
                    
                    if (myStuffMsg === '我的作品') {
                        console.log('🎉 自定义翻译已在初始化时生效！无需后续强制渲染');
                    } else {
                        console.log('⚠️ 初始翻译未生效，可能需要fallback方案');
                    }
                    
                    // 添加简化的调试函数
                    window.checkTranslations = () => {
                        const state = window._reduxStore.getState();
                        console.log('🔍 当前翻译状态:');
                        console.log('  locale:', state.locales.locale);
                        console.log('  gui.accountMenu.myStuff:', state.locales.messages['gui.accountMenu.myStuff']);
                        console.log('  gui.accountMenu.myClasses:', state.locales.messages['gui.accountMenu.myClasses']);
                        console.log('  gui.accountMenu.profile:', state.locales.messages['gui.accountMenu.profile']);
                    };
                    
                    console.log('🎮 Session state 已注入!');
                    console.log('🔧 调试命令: window.checkTranslations()');
                }
            }, 100);
        }
        
        render() {
            return <AppStateWithSession {...this.props} />;
        }
    }
    
    return SessionWrapper;
};

// 从全局配置中获取参数
const getConfig = () => {
  return window.SCRATCH_CONFIG || {
    canSave: true,
    canRemix: true,
    canCreateNew: true,
    canEditTitle: true,
    enableCommunity: false,
    showComingSoon: true,
    projectHost: "",
    projectId: "",
    basePath: "./",
    assetHost: "",
    host: "http://localhost:8080",
    projectsRoute: "/www/scratch/projects",
    projectTitle: "",
    username: "",
    nickname: "",
  };
};

const onClickLogo = () => {
  let cfg=getConfig()
  window.location = cfg.projectsRoute;
};


const App = () => {
  // 获取配置
  const config = getConfig();
  
  // 使用带 session 的 AppStateHOC - 参考 render-gui.jsx 的方式
  const WrappedGui = compose(
    AppStateHOCWithSession,
  )(GUI);

  const onUpdateProjectThumbnail = async (projectId, thumbnail) => {
    // 调用后端接口更新项目缩略图
    const response =await fetch(`${config.host}/api/scratch/projects/${projectId}/thumbnail`, {
      method: 'PUT',
      body: thumbnail ,
    });
    if (response.ok) {
      console.log('更新项目缩略图成功');
    } else {
      console.log('更新项目缩略图失败');
    }
  };

  // 添加 renderLogin 函数
  const renderLogin = (props) => {
    return (
      <div className="login-container">
        <button 
          onClick={() => {
            // 可以跳转到登录页面或显示登录模态框
            window.location.href = config.projectsRoute;
          }}
          className="login-button"
        >
          登录
        </button>
      </div>
    );
  };
  
  return (    
    <div className="scratch-editor" style={{ height: '100vh' }}>
      <WrappedGui
        canSave={config.canSave}
        canRemix={config.canRemix}
        canCreateNew={config.canCreateNew}
        canEditTitle={config.canEditTitle}
        enableCommunity={config.enableCommunity}
        showComingSoon={config.showComingSoon}
        projectHost={config.projectHost}
        projectId={config.projectId}
        basePath={config.basePath}
        assetHost={config.assetHost}
        onClickLogo={onClickLogo}
        projectTitle={config.projectTitle}
        onUpdateProjectThumbnail={onUpdateProjectThumbnail}
        renderLogin={renderLogin}
        myStuffUrl={`${config.projectsRoute}`}
      />
    </div>      
  );
};
export default App;