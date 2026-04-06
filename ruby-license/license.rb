require 'net/http'
require 'uri'
require 'json'
require 'digest'
require 'fileutils'

module Iiiaha
  module License
    unless defined?(@loaded) && @loaded
    @loaded = true

    @dialog_count = 0

    SERVER_URL = "https://iiiahalab.com/api/license"
    VERSION_URL = "https://iiiahalab.com/api/version"
    SITE_URL = "https://iiiahalab.com"
    GRACE_DAYS = 3

    # ─── 하드웨어 ID ───
    def self.generate_hwid
      # メモリキャッシュ
      return @hwid_cache if @hwid_cache

      # ファイルキャッシュ
      hwid_file = File.join(cache_dir, '.hwid')
      if File.exist?(hwid_file)
        @hwid_cache = File.read(hwid_file).strip
        return @hwid_cache if @hwid_cache.length > 0
      end

      # 初回のみ生成 (CMD窓が出るのはこの1回だけ)
      raw = case RUBY_PLATFORM
      when /mswin|mingw|cygwin/
        begin
          require 'win32/registry'
          Win32::Registry::HKEY_LOCAL_MACHINE.open('HARDWARE\\DESCRIPTION\\System\\BIOS') do |reg|
            reg['BaseBoardSerialNumber']
          end
        rescue
          `wmic baseboard get serialnumber`.strip.split("\n").last.strip rescue "win-unknown"
        end
      when /darwin/
        `ioreg -rd1 -c IOPlatformExpertDevice`.scan(/UUID.*?"(.*?)"/).flatten.first rescue "mac-unknown"
      else
        "unknown"
      end

      @hwid_cache = Digest::SHA256.hexdigest("iiiaha-#{raw}")[0..31]
      File.write(hwid_file, @hwid_cache) rescue nil
      @hwid_cache
    end

    # ─── 캐시 파일 경로 ───
    def self.cache_dir
      dir = if RUBY_PLATFORM =~ /mswin|mingw|cygwin/
        File.join(ENV['APPDATA'] || Dir.home, 'iiiaha', 'licenses')
      else
        File.join(Dir.home, '.iiiaha', 'licenses')
      end
      FileUtils.mkdir_p(dir) unless File.exist?(dir)
      dir
    end

    def self.cache_path(product_slug)
      File.join(cache_dir, "#{product_slug}.lic")
    end

    # ─── 캐시 읽기/쓰기 ───
    def self.read_cache(product_slug)
      path = cache_path(product_slug)
      return nil unless File.exist?(path)
      JSON.parse(File.read(path)) rescue nil
    end

    def self.write_cache(product_slug, token, signature)
      data = { "token" => token, "signature" => signature }
      File.write(cache_path(product_slug), JSON.generate(data))
    end

    def self.delete_cache(product_slug)
      path = cache_path(product_slug)
      File.delete(path) if File.exist?(path)
    end

    # ─── 서버 통신 ───
    def self.http_post(endpoint, body)
      uri = URI("#{SERVER_URL}/#{endpoint}")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      http.open_timeout = 10
      http.read_timeout = 10

      req = Net::HTTP::Post.new(uri.path, { 'Content-Type' => 'application/json' })
      req.body = JSON.generate(body)
      res = http.request(req)
      [res.code.to_i, JSON.parse(res.body)]
    rescue => e
      [0, { "error" => e.message }]
    end

    def self.activate(product_slug, license_key)
      hwid = generate_hwid
      code, data = http_post("activate", {
        license_key: license_key,
        product_slug: product_slug,
        hwid: hwid
      })

      if code == 200
        write_cache(product_slug, data["token"], data["signature"])
        { success: true, status: data["status"] }
      else
        { success: false, error: data["error"] || "Activation failed" }
      end
    end

    def self.verify_online(product_slug)
      cache = read_cache(product_slug)
      return { success: false, error: "No cache" } unless cache

      token = cache["token"]
      code, data = http_post("verify", {
        license_key: token["license_key"],
        product_slug: product_slug,
        hwid: token["hwid"]
      })

      # 해지된 라이선스면 캐시 삭제
      if code == 403 && data["error"]&.include?("revoked")
        delete_cache(product_slug)
        return { success: false, error: "License has been revoked" }
      end

      if code == 200
        write_cache(product_slug, data["token"], data["signature"])
        { success: true }
      else
        { success: false, error: data["error"] || "Verification failed" }
      end
    end

    # ─── 업데이트 체크 ───
    def self.check_update(product_slug, local_version)
      Thread.new do
        begin
          uri = URI("#{VERSION_URL}?slug=#{product_slug}")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = (uri.scheme == "https")
          http.open_timeout = 5
          http.read_timeout = 5

          res = http.request(Net::HTTP::Get.new(uri))
          return unless res.code.to_i == 200

          data = JSON.parse(res.body)
          remote_version = data["version"]
          display_name = data["display_name"] || product_slug

          return unless remote_version
          return if remote_version == local_version

          # 버전 비교 (semantic versioning)
          local_parts = local_version.split('.').map(&:to_i)
          remote_parts = remote_version.split('.').map(&:to_i)
          return unless (remote_parts <=> local_parts) > 0

          # 메인 스레드에서 알림 표시
          UI.start_timer(0, false) do
            result = UI.messagebox(
              "#{display_name} v#{remote_version} is available.\n" \
              "You are using v#{local_version}.\n\n" \
              "Visit iiiaha.lab to download the update?",
              MB_YESNO
            )
            if result == IDYES
              UI.openURL("#{SITE_URL}/extensions/#{product_slug}")
            end
          end
        rescue
          # 업데이트 체크 실패는 무시
        end
      end
    end

    # ─── 메인 체크 ───
    def self.check(product_slug, local_version = nil, &on_success)
      # caller에서 호출한 파일의 디렉토리를 구함 (아이콘 경로용)
      caller_dir = File.dirname(caller_locations(1, 1)[0].path) rescue File.dirname(__FILE__)
      @_caller_dirs ||= {}
      @_caller_dirs[product_slug] = caller_dir

      cache = read_cache(product_slug)
      hwid = generate_hwid

      if cache
        token = cache["token"]
        # HWID 일치 확인
        if token["hwid"] == hwid
          expires = Time.parse(token["expires_check"]) rescue Time.now
          if Time.now < expires
            # 캐시 유효 → 바로 실행
            on_success.call if on_success
            check_update(product_slug, local_version) if local_version
            return true
          else
            # 만료 → 온라인 재검증
            result = verify_online(product_slug)
            if result[:success]
              on_success.call if on_success
              check_update(product_slug, local_version) if local_version
              return true
            elsif result[:error]&.include?("revoked")
              # 해지됨 → 캐시 삭제, 라이선스 창 표시
              delete_cache(product_slug)
              show_license_dialog(product_slug, &on_success)
              return false
            else
              # 유예 기간 (3일)
              grace_until = expires + (GRACE_DAYS * 86400)
              if Time.now < grace_until
                on_success.call if on_success
                check_update(product_slug, local_version) if local_version
                return true
              end
            end
          end
        end
        # HWID 불일치 → 캐시 삭제
        delete_cache(product_slug)
      end

      # 라이선스 입력 필요
      show_license_dialog(product_slug, &on_success)
      false
    end

    # ─── 라이선스 입력 다이얼로그 ───
    def self.show_license_dialog(product_slug, &on_success)
      ext_dir = @_caller_dirs && @_caller_dirs[product_slug] || File.dirname(__FILE__)
      html_path = File.join(ext_dir, 'html', 'license.html')

      dlg = UI::HtmlDialog.new(
        dialog_title: "License — #{product_slug}",
        width: 340,
        height: 200,
        resizable: false,
        style: UI::HtmlDialog::STYLE_DIALOG
      )

      dlg.add_action_callback('activate') do |_ctx, key|
        result = activate(product_slug, key.strip)
        if result[:success]
          dlg.execute_script("showResult('License activated successfully!', true)")
          UI.start_timer(1.5, false) do
            dlg.close
            on_success.call if on_success
          end
        else
          dlg.execute_script("showResult('#{result[:error].gsub("'", "\\\\'")}', false)")
        end
      end

      dlg.add_action_callback('fitHeight') do |_, h|
        dlg.set_size(340, h.to_i + 31) if h.to_i > 0
      end

      dlg.add_action_callback('openLink') do |_, url|
        UI.openURL(url)
      end

      # 제품 이름과 아이콘 경로 (호출한 익스텐션 폴더 기준)
      ext_dir = @_caller_dirs && @_caller_dirs[product_slug] || File.dirname(__FILE__)
      icon_path = File.join(ext_dir, 'icon.png')
      icon_url = File.exist?(icon_path) ? "file:///#{icon_path.gsub('\\', '/')}" : ""
      display_name = product_slug

      dlg.add_action_callback('getProductInfo') do |_ctx|
        js = "setProductInfo('#{display_name}', '#{icon_url}')"
        dlg.execute_script(js)
      end

      dlg.set_file(html_path)
      dlg.show

      # 겹치지 않게 오프셋 배치
      offset = @dialog_count * 30
      @dialog_count += 1
      vp_w = Sketchup.active_model.active_view.vpwidth
      vp_h = Sketchup.active_model.active_view.vpheight
      left = [(vp_w - 340) / 2 + offset, 0].max
      top = [(vp_h - 200) / 2 + offset, 0].max
      dlg.set_position(left, top)

      dlg.set_on_closed { @dialog_count = [@dialog_count - 1, 0].max }
    end
  end # unless @loaded
  end
end
