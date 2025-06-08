#!/bin/bash

# 百刀会 Supabase PostgreSQL 备份脚本
# 使用方法: ./supabase-backup.sh [backup|restore] [backup_file]

set -e

# 配置
SUPABASE_DB_URL=${SUPABASE_DB_URL:-""}
BACKUP_DIR=${BACKUP_DIR:-"./backups/supabase"}
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="supabase_${DATE}.sql"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 检查依赖
check_dependencies() {
    if ! command -v pg_dump &> /dev/null; then
        log "错误: pg_dump 未安装"
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        log "错误: psql 未安装"
        exit 1
    fi
    
    if [ -z "$SUPABASE_DB_URL" ]; then
        log "错误: 请设置 SUPABASE_DB_URL 环境变量"
        exit 1
    fi
}

# 备份函数
backup() {
    log "开始备份 Supabase PostgreSQL 数据库"
    
    # 备份数据库结构和数据
    pg_dump "$SUPABASE_DB_URL" \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain \
        --no-owner \
        --no-privileges \
        --exclude-schema=auth \
        --exclude-schema=storage \
        --exclude-schema=realtime \
        --exclude-schema=supabase_functions \
        --exclude-schema=extensions \
        --exclude-schema=graphql \
        --exclude-schema=graphql_public \
        --exclude-schema=pgsodium \
        --exclude-schema=pgsodium_masks \
        --exclude-schema=vault \
        > "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        log "备份成功: $BACKUP_DIR/$BACKUP_FILE"
        
        # 压缩备份文件
        gzip "$BACKUP_DIR/$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE}.gz"
        
        # 计算文件大小
        SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        log "压缩后文件大小: $SIZE"
        
        # 清理旧备份（保留最近7天）
        find "$BACKUP_DIR" -name "supabase_*.sql.gz" -mtime +7 -delete
        log "已清理7天前的旧备份文件"
        
        # 发送通知（如果配置了Bark）
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "Supabase备份成功" "文件: $BACKUP_FILE, 大小: $SIZE, 服务器: $(hostname)"
        fi
    else
        log "备份失败"
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "Supabase备份失败" "请检查数据库连接, 服务器: $(hostname)"
        fi
        exit 1
    fi
}

# 恢复函数
restore() {
    local restore_file="$1"
    
    if [ -z "$restore_file" ]; then
        log "错误: 请指定要恢复的备份文件"
        echo "使用方法: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$restore_file" ]; then
        log "错误: 备份文件不存在: $restore_file"
        exit 1
    fi
    
    log "开始恢复 Supabase PostgreSQL 数据库"
    log "备份文件: $restore_file"
    
    # 确认恢复操作
    read -p "确认要恢复数据库吗？这将覆盖现有数据 (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log "恢复操作已取消"
        exit 0
    fi
    
    # 检查文件是否压缩
    if [[ "$restore_file" == *.gz ]]; then
        log "解压备份文件..."
        gunzip -c "$restore_file" | psql "$SUPABASE_DB_URL" --verbose
    else
        psql "$SUPABASE_DB_URL" --verbose < "$restore_file"
    fi
    
    if [ $? -eq 0 ]; then
        log "恢复成功"
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "Supabase恢复成功" "文件: $(basename $restore_file), 服务器: $(hostname)"
        fi
    else
        log "恢复失败"
        if [ -n "$BARK_API_URL" ]; then
            send_bark_notification "Supabase恢复失败" "请检查备份文件和数据库状态, 服务器: $(hostname)"
        fi
        exit 1
    fi
}

# 备份RLS策略
backup_rls_policies() {
    log "备份 RLS 策略..."
    
    local rls_file="$BACKUP_DIR/rls_policies_${DATE}.sql"
    
    psql "$SUPABASE_DB_URL" -c "
        SELECT 
            'CREATE POLICY ' || quote_ident(pol.polname) || ' ON ' || 
            quote_ident(n.nspname) || '.' || quote_ident(c.relname) || 
            ' FOR ' || pol.polcmd || 
            CASE WHEN pol.polroles != '{0}' THEN ' TO ' || array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)), ', ') ELSE '' END ||
            CASE WHEN pol.polqual IS NOT NULL THEN ' USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')' ELSE '' END ||
            CASE WHEN pol.polwithcheck IS NOT NULL THEN ' WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' ELSE '' END || ';'
        FROM pg_policy pol
        JOIN pg_class c ON pol.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY n.nspname, c.relname, pol.polname;
    " -t -o "$rls_file"
    
    if [ $? -eq 0 ]; then
        log "RLS策略备份成功: $rls_file"
        gzip "$rls_file"
    else
        log "RLS策略备份失败"
    fi
}

# 发送Bark推送通知
send_bark_notification() {
    local title="$1"
    local message="$2"
    
    if [ -n "$BARK_API_URL" ]; then
        curl -s -X POST "${BARK_API_URL}/${title}/${message}?group=数据库备份&sound=bell" > /dev/null
    fi
}

# 列出备份文件
list_backups() {
    log "可用的备份文件:"
    ls -lh "$BACKUP_DIR"/supabase_*.sql.gz 2>/dev/null || log "没有找到备份文件"
    echo ""
    log "RLS策略备份:"
    ls -lh "$BACKUP_DIR"/rls_policies_*.sql.gz 2>/dev/null || log "没有找到RLS策略备份"
}

# 主函数
main() {
    check_dependencies
    
    case "$1" in
        backup)
            backup
            backup_rls_policies
            ;;
        restore)
            restore "$2"
            ;;
        rls-backup)
            backup_rls_policies
            ;;
        list)
            list_backups
            ;;
        *)
            echo "百刀会 Supabase PostgreSQL 备份工具"
            echo ""
            echo "使用方法:"
            echo "  $0 backup                    # 创建完整备份"
            echo "  $0 restore <backup_file>     # 恢复备份"
            echo "  $0 rls-backup               # 仅备份RLS策略"
            echo "  $0 list                      # 列出备份文件"
            echo ""
            echo "环境变量:"
            echo "  SUPABASE_DB_URL        Supabase数据库连接URL"
            echo "  BACKUP_DIR             备份目录 (默认: ./backups/supabase)"
            echo "  TELEGRAM_BOT_TOKEN     Telegram机器人令牌"
            echo "  TELEGRAM_CHAT_ID       Telegram聊天ID"
            echo ""
            echo "注意: 需要安装 postgresql-client 包"
            exit 1
            ;;
    esac
}

main "$@" 