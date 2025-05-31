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

// 创建带 session 的 AppStateHOC - 参考 render-gui.jsx 的实现
const AppStateHOCWithSession = (WrappedComponent) => {
    const AppStateWithSession = AppStateHOC(
        WrappedComponent,
        false, // 不是 localesOnly
        { session: sessionReducer }, // 额外的 reducers
        { session: undefined } // 额外的初始状态
    );
    
    // 简单包装，添加调试功能
    class SessionWrapper extends React.Component {
        componentDidMount() {
            // 从配置中获取用户信息并设置到 session
            const config = getConfig();
            
            // AppStateHOC 已经暴露了 store，直接添加调试功能
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
                    
                    // 添加调试函数
                    window.switchUser = (username) => {
                        window._reduxStore.dispatch({
                            type: 'SET_SESSION_USER',
                            payload: { username }
                        });
                    };
                    
                    window.setUserPermissions = (permissions) => {
                        window._reduxStore.dispatch({
                            type: 'SET_SESSION_PERMISSIONS',
                            payload: permissions
                        });
                    };
                    
                    // 调试Redux state结构
                    window.debugStore = () => {
                        const state = window._reduxStore.getState();
                        console.log('🔍 完整的Redux State:', state);
                        console.log('🔍 State keys:', Object.keys(state));
                        
                        // 查找可能的intl相关state
                        Object.keys(state).forEach(key => {
                            if (key.toLowerCase().includes('intl') || 
                                key.toLowerCase().includes('locale') || 
                                key.toLowerCase().includes('message')) {
                                console.log(`🌐 找到可能的国际化相关state: ${key}`, state[key]);
                            }
                        });
                        
                        return state;
                    };
                    
                    // 尝试覆盖国际化消息的各种方法
                    window.overrideMessages = () => {
                        const customMessages = {
                            'gui.accountMenu.myStuff': '我的作品'
                        };
                        
                        const state = window._reduxStore.getState();
                        console.log('🔍 当前locale state:', state.locales);
                        console.log('🔍 当前messages keys数量:', Object.keys(state.locales.messages).length);
                        
                        // 查看是否已有gui.accountMenu.myStuff
                        const currentMsg = state.locales.messages['gui.accountMenu.myStuff'];
                        console.log('🔍 当前gui.accountMenu.myStuff值:', currentMsg);
                        
                        // 方法4: 直接通过reducer action更新messages
                        try {
                            window._reduxStore.dispatch({
                                type: 'scratch-gui/locales/SET_LOCALE_MESSAGES',
                                messages: {
                                    ...state.locales.messages,
                                    ...customMessages
                                }
                            });
                            console.log('✅ 方法4: SET_LOCALE_MESSAGES 已尝试');
                        } catch (e) {
                            console.log('❌ 方法4失败:', e.message);
                        }
                        
                        // 方法5: 尝试完整的locales更新
                        try {
                            window._reduxStore.dispatch({
                                type: 'scratch-gui/locales/SELECT_LOCALE',
                                locale: state.locales.locale,
                                messages: {
                                    ...state.locales.messages,
                                    ...customMessages
                                },
                                isRtl: state.locales.isRtl
                            });
                            console.log('✅ 方法5: 完整SELECT_LOCALE 已尝试');
                        } catch (e) {
                            console.log('❌ 方法5失败:', e.message);
                        }
                        
                        // 方法6: 直接修改state对象（这是hack方法，但有时候有效）
                        try {
                            state.locales.messages['gui.accountMenu.myStuff'] = '我的作品';
                            console.log('✅ 方法6: 直接修改state对象');
                            
                            // 强制重新渲染
                            window._reduxStore.dispatch({ type: 'FORCE_RENDER' });
                        } catch (e) {
                            console.log('❌ 方法6失败:', e.message);
                        }
                        
                        // 检查修改后的结果
                        setTimeout(() => {
                            const newState = window._reduxStore.getState();
                            const newMsg = newState.locales.messages['gui.accountMenu.myStuff'];
                            console.log('🔍 修改后的gui.accountMenu.myStuff值:', newMsg);
                        }, 100);
                    };
                    
                    // 搜索messages中相关的key
                    window.searchMessages = (keyword = 'stuff') => {
                        const state = window._reduxStore.getState();
                        const messages = state.locales.messages;
                        
                        console.log(`🔍 搜索包含 "${keyword}" 的消息keys:`);
                        Object.keys(messages).forEach(key => {
                            if (key.toLowerCase().includes(keyword.toLowerCase()) ||
                                messages[key].toLowerCase().includes(keyword.toLowerCase())) {
                                console.log(`  ${key}: "${messages[key]}"`);
                            }
                        });
                        
                        console.log('🔍 搜索包含 "我的" 的消息:');
                        Object.keys(messages).forEach(key => {
                            if (messages[key].includes('我的')) {
                                console.log(`  ${key}: "${messages[key]}"`);
                            }
                        });
                        
                        console.log('🔍 搜索包含 "account" 的消息keys:');
                        Object.keys(messages).forEach(key => {
                            if (key.toLowerCase().includes('account')) {
                                console.log(`  ${key}: "${messages[key]}"`);
                            }
                        });
                    };
                    
                    // 自动覆盖国际化消息
                    this.autoOverrideMessages();
                    
                    console.log('🎮 Session state 已注入!');
                    console.log('🔧 调试命令:');
                    console.log('  - window.switchUser("Alice")');
                    console.log('  - window.setUserPermissions({educator: true})');
                    console.log('  - window.debugStore() - 查看完整Redux state');
                    console.log('  - window.overrideMessages() - 手动覆盖翻译');
                    console.log('  - window.searchMessages("stuff") - 搜索相关消息key');
                }
            }, 100);
        }
        
        // 自动覆盖国际化消息
        autoOverrideMessages() {
            const store = window._reduxStore;
            if (!store) return;
            
            try {
                const state = store.getState();
                if (state.locales && state.locales.messages) {
                    // 定义自定义翻译映射
                    const customTranslations = {
                        'gui.accountMenu.myStuff': '我的作品',
                        // 可以在这里添加更多需要覆盖的翻译
                        // 'gui.someOtherKey': '其他翻译',
                    };
                    
                    // 直接修改state对象中的messages（方法6 - 已验证有效）
                    Object.keys(customTranslations).forEach(key => {
                        if (state.locales.messages.hasOwnProperty(key)) {
                            state.locales.messages[key] = customTranslations[key];
                            console.log(`✅ 已覆盖翻译: ${key} -> ${customTranslations[key]}`);
                        }
                    });
                    
                    // 强制重新渲染
                    store.dispatch({ type: 'FORCE_RENDER' });
                    
                    console.log('🌐 国际化消息自动覆盖完成');
                } else {
                    console.log('⚠️ 未找到locales state，稍后重试');
                    // 如果state还没准备好，稍后重试
                    setTimeout(() => this.autoOverrideMessages(), 500);
                }
            } catch (error) {
                console.log('❌ 自动覆盖国际化消息失败:', error);
            }
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